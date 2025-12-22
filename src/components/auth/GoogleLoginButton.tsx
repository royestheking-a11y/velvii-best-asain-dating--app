
import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
        <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
    </svg>
);

const GoogleLoginButton = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const loginGoogle = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                // For 'implicit' flow or 'id_token' flow, library behavior differs.
                // useGoogleLogin with default flow returns 'access_token'.
                // To get 'id_token' resembling the <GoogleLogin> component, we can use 'flow: auth-code'
                // OR we can just verify the access token on backend via a user info endpoint.
                // EASIEST PATH: switch backend to verify access token OR fetch user info with it.
                // LET'S STICK TO ID_TOKEN if possible, but useGoogleLogin gives access_token primarily.
                // ACTUALLY: The easiest robust way is sending the access_token to backend, 
                // and backend calls https://www.googleapis.com/oauth2/v3/userinfo

                // Let's modify backend slightly to accept access_token OR just fetch profile here?
                // Better: Fetch profile here (client side) then send to backend as "Social Login"
                // RISK: Insecure to trust client data.
                // SECURE PATH: Send access_token to backend. Backend validates.

                // HOWEVER, to minimize backend changes (we built it for id_token credential), 
                // let's see if we can get id_token from this hook.
                // We likely cannot easily get the raw JWT credential that the pre-built button gives 
                // without 'flow: implicit' (deprecated) or complex setup.

                // ALTERNATIVE: Just use the button component but style it? 
                // The <GoogleLogin> component is an iframe, hard to style.

                // PLAN B (Better UX): 
                // 1. Get Access Token.
                // 2. Send to backend endpoint /api/auth/google-access-token
                // 3. Backend uses that to fetch user info.

                // Let's try sending the access token to existing endpoint and tweaking backend 
                // to handle "if it looks like an access token, use userinfo endpoint".

                const res = await api.post('/auth/google', {
                    accessToken: tokenResponse.access_token
                });

                login(res.data);

                if (res.data.isProfileComplete === false) {
                    toast.success("Welcome! Please complete your profile.");
                    navigate('/onboarding');
                } else {
                    toast.success("Logged in successfully!");
                    navigate('/');
                }

            } catch (error) {
                console.error("Google Login Failed", error);
                toast.error("Google Login Failed");
            }
        },
        onError: () => toast.error('Login Failed'),
    });

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => loginGoogle()}
            className="w-full flex items-center justify-center px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all text-gray-700 font-medium"
        >
            <GoogleIcon />
            Continue with Google
        </motion.button>
    );
};

export default GoogleLoginButton;
