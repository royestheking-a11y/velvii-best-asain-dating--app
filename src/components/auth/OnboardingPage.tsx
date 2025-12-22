
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react'; // Using 'motion/react' as per user preference (or 'framer-motion' if standard, checking previous files: 'motion/react' confirmed)
import { toast } from 'sonner';
import { MapPin, User, ArrowRight, Calendar, Heart, Sparkles } from 'lucide-react';
import { cn } from '@/utils/helpers';

const OnboardingPage = () => {
    const { currentUser, updateCurrentUser } = useAuth();
    const navigate = useNavigate();

    // Form States
    const [gender, setGender] = useState<string>('');
    const [interestedIn, setInterestedIn] = useState<string>('');
    const [location, setLocation] = useState<{ lat: number, lng: number, city: string, country: string } | null>(null);
    const [dateOfBirth, setDateOfBirth] = useState<string>('');

    // UI States
    const [isLoading, setIsLoading] = useState(false);
    const [locLoading, setLocLoading] = useState(false);

    // Redirect if already complete
    useEffect(() => {
        if (currentUser?.isProfileComplete) {
            navigate('/app');
        }
    }, [currentUser, navigate]);

    const handleGetLocation = () => {
        setLocLoading(true);
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            setLocLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                // Using BigDataCloud Free API for reverse geocoding
                const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                const data = await res.json();

                setLocation({
                    lat: latitude,
                    lng: longitude,
                    city: data.city || data.locality || 'Unknown',
                    country: data.countryName || 'Unknown'
                });
                toast.success("Location verified!");
            } catch (error) {
                console.error("Loc Error", error);
                // Fallback to storing coords only
                setLocation({ lat: latitude, lng: longitude, city: 'Unknown', country: 'Unknown' });
                toast.success("Coordinates captured");
            } finally {
                setLocLoading(false);
            }
        }, (error) => {
            console.error("Geo Error", error);
            toast.error("Please allow location access to continue matching.");
            setLocLoading(false);
        });
    };

    const calculateAge = (dob: string) => {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const handleSubmit = async () => {
        if (!gender || !interestedIn || !dateOfBirth || !location) {
            toast.error("Please fill in all details");
            return;
        }

        const age = calculateAge(dateOfBirth);
        if (age < 18) {
            toast.error("You must be 18+ to use Velvii");
            return;
        }

        setIsLoading(true);
        try {
            await updateCurrentUser({
                gender: gender as any,
                interestedIn: interestedIn as any,
                location: {
                    city: location.city,
                    country: location.country,
                    coordinates: { lat: location.lat, lng: location.lng }
                },
                dateOfBirth,
                age,
                isProfileComplete: true
            });
            toast.success("Profile completed! Welcome to Velvii.");
            navigate('/app'); // Redirect to Main App
        } catch (error) {
            console.error(error);
            toast.error("Failed to save profile. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Selection Card Component
    const SelectionCard = ({
        selected,
        onClick,
        icon: Icon,
        label
    }: { selected: boolean; onClick: () => void; icon: any; label: string }) => (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 w-full aspect-square",
                selected
                    ? "border-[#FF6B6B] bg-red-50 text-[#FF6B6B]"
                    : "border-gray-100 bg-gray-50 text-gray-400 hover:border-[#FF6B6B]/30 hover:bg-red-50/30"
            )}
        >
            <Icon className={cn("w-8 h-8 mb-2", selected ? "fill-current" : "")} />
            <span className="font-medium text-sm">{label}</span>
        </button>
    );

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-red-50 to-transparent pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg relative z-10"
            >
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-tr from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center mb-4 shadow-lg shadow-orange-200">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Almost There!</h1>
                    <p className="text-gray-500">Just a few quick details to set up your profile.</p>
                </div>

                <div className="space-y-8">

                    {/* 1. I am a... */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            I am a...
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <SelectionCard
                                label="Man"
                                icon={User}
                                selected={gender === 'male'}
                                onClick={() => setGender('male')}
                            />
                            <SelectionCard
                                label="Woman"
                                icon={User}
                                selected={gender === 'female'}
                                onClick={() => setGender('female')}
                            />
                        </div>
                    </div>

                    {/* 2. Interested in... */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700">Interested in...</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setInterestedIn('women')}
                                className={cn(
                                    "py-3 px-2 rounded-xl text-sm font-medium transition-all border",
                                    interestedIn === 'women'
                                        ? "bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white border-transparent shadow-md"
                                        : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
                                )}
                            >
                                Women
                            </button>
                            <button
                                onClick={() => setInterestedIn('men')}
                                className={cn(
                                    "py-3 px-2 rounded-xl text-sm font-medium transition-all border",
                                    interestedIn === 'men'
                                        ? "bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white border-transparent shadow-md"
                                        : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
                                )}
                            >
                                Men
                            </button>
                            <button
                                onClick={() => setInterestedIn('everyone')}
                                className={cn(
                                    "py-3 px-2 rounded-xl text-sm font-medium transition-all border",
                                    interestedIn === 'everyone'
                                        ? "bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white border-transparent shadow-md"
                                        : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
                                )}
                            >
                                Everyone
                            </button>
                        </div>
                    </div>

                    {/* 3. Birthday */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-[#FF6B6B]" />
                            Birthday
                        </label>
                        <input
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]/50 transition-all font-medium text-gray-900"
                        />
                        <p className="text-xs text-gray-400 pl-1">Age will be public. Must be 18+.</p>
                    </div>

                    {/* 4. Location */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#FF6B6B]" />
                            Location
                        </label>
                        <button
                            onClick={handleGetLocation}
                            disabled={locLoading || !!location}
                            className={cn(
                                "w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all font-medium",
                                location
                                    ? "border-green-500 bg-green-50 text-green-700"
                                    : "border-gray-300 text-gray-500 hover:border-[#FF6B6B] hover:text-[#FF6B6B]"
                            )}
                        >
                            {locLoading ? (
                                <span className="animate-pulse">Finding you...</span>
                            ) : location ? (
                                <>✅ {location.city}, {location.country}</>
                            ) : (
                                "Tap to Enable Location"
                            )}
                        </button>
                    </div>

                    {/* Submit */}
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmit}
                        disabled={isLoading || !gender || !interestedIn || !dateOfBirth || !location}
                        className="w-full py-4 mt-4 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white rounded-2xl text-lg font-bold shadow-xl shadow-orange-200 hover:shadow-2xl hover:shadow-orange-300 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {isLoading ? "Setting up..." : "Start Matching"}
                    </motion.button>

                </div>
            </motion.div>
        </div>
    );
};

export default OnboardingPage;
