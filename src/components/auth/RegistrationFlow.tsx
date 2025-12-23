import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Camera, ChevronRight, ChevronLeft, Check, MapPin, Navigation, Mail, Timer, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import { useAuth } from '@/contexts/AuthContext';
import { auth as authApi, upload as uploadApi } from '@/services/api';
import { compressImage, generateVelviiId, calculateAge } from '@/utils/helpers';
import { LocationService } from '@/utils/location';
import { getAllUsers } from '@/utils/storage';
import { OtpInput } from '@/components/ui/OtpInput';

// EmailJS Credentials (from .env)
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID_OTP = import.meta.env.VITE_EMAILJS_REGISTRATION_TEMPLATE_ID || import.meta.env.VITE_EMAILJS_TEMPLATE_ID_OTP;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

interface RegistrationData {
  email: string;
  password: string;
  username: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  interestedIn: 'men' | 'women' | 'everyone';
  location: {
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  isAutoLocation?: boolean;
  photos: string[];
}

export const RegistrationFlow: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Get initial data from multiple sources to be robust
  const stateEmail = location.state?.email || '';
  const statePassword = location.state?.password || '';

  // Steps: 
  // 1: Email Verification
  // 2: Username & Name
  // 3: DOB
  // 4: Gender/Interest
  // 5: Location
  // 6: Photos
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // OTP State
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  const [data, setData] = useState<RegistrationData>({
    email: stateEmail,
    password: statePassword,
    username: '',
    fullName: '',
    dateOfBirth: '',
    gender: 'male',
    interestedIn: 'women',
    location: {
      city: '',
      country: '',
    },
    photos: [],
  });

  useEffect(() => {
    emailjs.init(PUBLIC_KEY);
  }, []);

  useEffect(() => {
    if (!stateEmail || !statePassword) {
      if (!data.email) {
        navigate('/signup');
      }
    }
  }, [stateEmail, statePassword, navigate, data.email]);

  // Timer Logic
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [isLocating, setIsLocating] = useState(false);

  const handleAutoLocation = async () => {
    setIsLocating(true);
    try {
      const position = await LocationService.getCurrentPosition();
      const { latitude, longitude } = position.coords;

      const locationData = await LocationService.reverseGeocode(latitude, longitude);

      updateData({
        location: {
          city: locationData.city,
          country: locationData.country,
          coordinates: { lat: latitude, lng: longitude }
        },
        isAutoLocation: true
      });

      toast.success('Location found!');
    } catch (error) {
      console.error(error);
      toast.error('Could not get your location. Please enter manually.');
    } finally {
      setIsLocating(false);
    }
  };

  const updateData = (updates: Partial<RegistrationData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  // --- OTP HANDLERS ---
  const handleSendOtp = async () => {
    if (!data.email) return;
    setIsVerifying(true);
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);

      console.log("Attempting to send OTP to:", data.email);

      const templateParams = {
        email: data.email,          // Matches {{email}} template variable
        to_email: data.email,       // Backup
        passcode: otp,
        time: new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString(),
      };

      // Pass PUBLIC_KEY explicitly as 4th arg
      await emailjs.send(SERVICE_ID, TEMPLATE_ID_OTP, templateParams, PUBLIC_KEY);

      setTimeLeft(300); // 5 mins
      toast.success(`Verification code sent to ${data.email}`);
    } catch (error: any) {
      console.error("Failed to send OTP - Details:", error);
      if (error.text) {
        console.error("EmailJS Error Text:", error.text);
      }
      toast.error("Failed to send code. Please check email address.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (enteredOtp !== generatedOtp) {
      toast.error("Invalid code. Please try again.");
      return;
    }
    setIsEmailVerified(true);
    toast.success("Email verified successfully!");
    setStep(2); // Move to Name step
  };

  // Auto-verify OTP when 6 digits entered
  useEffect(() => {
    if (step === 1 && enteredOtp.length === 6 && !isEmailVerified) {
      handleVerifyOtp();
    }
  }, [enteredOtp]);


  const handleNext = async () => {
    // Step 1: Verification
    if (step === 1) {
      if (!isEmailVerified) {
        if (generatedOtp && enteredOtp) {
          handleVerifyOtp();
        } else if (!generatedOtp) {
          handleSendOtp();
        } else {
          toast.error("Please enter the verification code");
        }
        return;
      }
    }

    // Step 2: Name
    if (step === 2 && !data.username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    // Step 3: DOB
    if (step === 3 && !data.dateOfBirth) {
      toast.error('Please select your date of birth');
      return;
    }

    // Step 5: Location
    if (step === 5 && (!data.location.city || !data.location.country)) {
      toast.error('Please enter your location');
      return;
    }

    // Step 6: Photos
    if (step === 6 && data.photos.length === 0) {
      toast.error('Please upload at least one photo');
      return;
    }

    if (step < 6) {
      setStep(step + 1);
    } else {
      await handleCompleteRegistration();
    }
  };

  const handleCompleteRegistration = async () => {
    const birthDate = new Date(data.dateOfBirth);
    const age = new Date().getFullYear() - birthDate.getFullYear();
    if (age < 18) {
      toast.error('You must be at least 18 years old to use Velvii');
      return;
    }

    try {
      setIsSubmitting(true);

      const userData = {
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        username: data.username,
        dateOfBirth: data.dateOfBirth,
        age: calculateAge(data.dateOfBirth),
        gender: data.gender,
        interestedIn: data.interestedIn,
        photos: data.photos,
        location: data.location,
        isVerified: false, // Email verified but profile verified is different
        isOnline: true,
        lastActive: new Date().toISOString(),
        isPremium: false,
        instantCircleEnabled: false,
        friendzoneModeEnabled: false,
        passwordLastChanged: new Date().toISOString(),
      };

      const newUser = await authApi.signup(userData);
      login(newUser);
      toast.success("Account created successfully!");
      navigate('/app');

    } catch (error: any) {
      console.error("Signup Error", error);
      toast.error(error.response?.data?.error || "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate('/signup');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Process files sequentially to avoid overwhelming the browser/network
    for (const file of Array.from(files)) {
      try {
        toast.loading('Processing image...', { id: 'upload-toast' });

        // 1. Compress
        const compressedBase64 = await compressImage(file);

        // 2. Upload to Cloudinary
        toast.loading('Uploading to cloud...', { id: 'upload-toast' });
        const imageUrl = await uploadApi.image(compressedBase64);

        // 3. Update State
        setData((prev) => ({
          ...prev,
          photos: [...prev.photos, imageUrl],
        }));

        toast.success('Image uploaded successfully', { id: 'upload-toast' });
      } catch (error) {
        console.error("Upload failed", error);
        toast.error('Failed to upload image', { id: 'upload-toast' });
      }
    }
  };

  const removePhoto = (index: number) => {
    setData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  // Auto-send OTP on first load of step 1
  useEffect(() => {
    if (step === 1 && !generatedOtp && data.email) {
      handleSendOtp();
    }
  }, [step, data.email]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
            VELVII
          </div>
          <div className="w-10" />
        </div>

        {/* Progress Bar */}
        <div className="max-w-2xl mx-auto mt-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 'bg-gray-200'
                  }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">

            {/* Step 1: Verification */}
            {step === 1 && (
              <motion.div
                key="step1-otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 text-center"
              >
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-10 h-10 text-orange-500" />
                </div>

                <div>
                  <h2 className="text-3xl mb-2 font-bold">Verify Your Email</h2>
                  <p className="text-gray-600">
                    We sent a verification code to <br />
                    <span className="font-semibold text-gray-900">{data.email}</span>
                  </p>
                </div>

                <div className="py-6">
                  <OtpInput value={enteredOtp} onChange={setEnteredOtp} />

                  <div className="flex items-center justify-center gap-2 mt-6 text-sm">
                    <Timer className="w-4 h-4 text-gray-400" />
                    {timeLeft > 0 ? (
                      <span className="text-orange-600 font-mono font-medium">{formatTime(timeLeft)}</span>
                    ) : (
                      <span className="text-red-500 font-medium">Code Expired</span>
                    )}
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  Didn't receive code?{" "}
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={timeLeft > 0 || isVerifying}
                    className="font-semibold text-gray-900 hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    Resend
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Username & Full Name */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl mb-2">What's your name?</h2>
                  <p className="text-gray-600">This will be shown on your profile</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2 text-gray-700">Full Name</label>
                    <input
                      type="text"
                      value={data.fullName}
                      onChange={(e) => {
                        const name = e.target.value;
                        updateData({ fullName: name });
                      }}
                      onBlur={() => {
                        if (data.fullName.trim()) {
                          const users = getAllUsers();
                          const existingUsernames = users.map(u => u.username);
                          const newId = generateVelviiId(data.fullName, existingUsernames);
                          updateData({ username: newId });
                        }
                      }}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700">Velvii ID (Auto-generated)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={data.username}
                        readOnly
                        placeholder="Your Velvii ID will appear here"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-600 focus:outline-none cursor-not-allowed"
                      />
                      {data.username && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                          <Check className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">This is your unique creative username</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Date of Birth */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl mb-2">When's your birthday?</h2>
                  <p className="text-gray-600">You must be 18+ to use Velvii</p>
                </div>

                <div>
                  <label className="block text-sm mb-2 text-gray-700">Date of Birth</label>
                  <input
                    type="date"
                    value={data.dateOfBirth}
                    onChange={(e) => updateData({ dateOfBirth: e.target.value })}
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 4: Gender & Interest */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl mb-2">Tell us about yourself</h2>
                  <p className="text-gray-600">This helps us show you relevant matches</p>
                </div>

                <div className="space-y-6">
                  {/* Gender */}
                  <div>
                    <label className="block text-sm mb-3 text-gray-700">I am a</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['male', 'female', 'other'] as const).map((gender) => (
                        <button
                          key={gender}
                          onClick={() => updateData({ gender })}
                          className={`py-4 px-6 rounded-xl border-2 transition-all ${data.gender === gender
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-300 hover:border-gray-400'
                            }`}
                        >
                          <div className="text-center capitalize">{gender}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interested In */}
                  <div>
                    <label className="block text-sm mb-3 text-gray-700">Interested in</label>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { value: 'women', label: 'Women' },
                        { value: 'men', label: 'Men' },
                        { value: 'everyone', label: 'Everyone' },
                      ] as const).map((interest) => (
                        <button
                          key={interest.value}
                          onClick={() => updateData({ interestedIn: interest.value })}
                          className={`py-4 px-6 rounded-xl border-2 transition-all ${data.interestedIn === interest.value
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-300 hover:border-gray-400'
                            }`}
                        >
                          <div className="text-center">{interest.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 5: Location */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl mb-2">Where are you located?</h2>
                  <p className="text-gray-600">We'll show you people nearby</p>
                </div>

                <button
                  onClick={handleAutoLocation}
                  disabled={isLocating}
                  className="w-full py-4 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors mb-4 disabled:opacity-50"
                  type="button"
                >
                  {isLocating ? (
                    <span className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <Navigation className="w-5 h-5" />
                  )}
                  <span>{isLocating ? 'Locating...' : 'Use My Current Location'}</span>
                </button>

                <div className="flex items-center gap-4 my-2">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <span className="text-gray-400 text-sm">OR</span>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2 text-gray-700">City</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={data.location.city}
                        onChange={(e) => updateData({ location: { ...data.location, city: e.target.value } })}
                        placeholder="e.g., San Francisco"
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700">Country</label>
                    <input
                      type="text"
                      value={data.location.country}
                      onChange={(e) => updateData({ location: { ...data.location, country: e.target.value } })}
                      placeholder="e.g., United States"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 6: Photos */}
            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl mb-2">Add your photos</h2>
                  <p className="text-gray-600">Upload at least 1 photo to continue (max 6)</p>
                </div>

                {/* Photo Grid */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Uploaded Photos */}
                  {data.photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-2xl overflow-hidden group">
                      <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {index === 0 && (
                        <div className="absolute bottom-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                          Main
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Upload Button */}
                  {data.photos.length < 6 && (
                    <label className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-orange-500 cursor-pointer flex flex-col items-center justify-center gap-2 transition-all bg-gray-50 hover:bg-orange-50">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <Upload className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-500">Upload</span>
                    </label>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <Camera className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-1">Photo Tips:</p>
                      <ul className="space-y-1 text-blue-700">
                        <li>• Use clear, recent photos</li>
                        <li>• Show your face clearly</li>
                        <li>• Add variety (close-up, full body, activities)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleNext}
            disabled={isSubmitting || (step === 1 && !isEmailVerified && !enteredOtp)}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting || isVerifying ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span className="text-lg">
                  {step === 6 ? 'Complete Profile' : step === 1 && !isEmailVerified ? 'Verify & Continue' : 'Continue'}
                </span>
                {step === 6 ? <Check className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
