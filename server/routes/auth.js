const express = require('express');
const router = express.Router();
const User = require('../models/User');

const { cloudinary } = require('../config/cloudinary');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google Login
router.post('/google', async (req, res) => {
    try {
        const { credential, accessToken } = req.body;
        let email, name, picture, googleId;

        if (credential) {
            // Old way: ID Token
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID
            });
            const payload = ticket.getPayload();
            email = payload.email;
            name = payload.name;
            picture = payload.picture;
            googleId = payload.sub;
        } else if (accessToken) {
            // New way: Access Token (from custom UI)
            // Fetch user info from Google
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!userInfoRes.ok) throw new Error('Failed to fetch user info');

            const userInfo = await userInfoRes.json();
            email = userInfo.email;
            name = userInfo.name;
            picture = userInfo.picture;
            googleId = userInfo.sub;
        } else {
            return res.status(400).json({ error: 'No token provided' });
        }

        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Create New User
            let finalPhoto = picture; // Default to Google URL (or undefined)

            // Only attempt upload if we actually have a picture URL
            if (picture) {
                try {
                    // Upload Google photo to Cloudinary for persistence
                    const uploadRes = await cloudinary.uploader.upload(picture, {
                        folder: 'velvii/users',
                        resource_type: 'image'
                    });
                    finalPhoto = uploadRes.secure_url;
                } catch (uploadError) {
                    console.error("Failed to upload Google photo to Cloudinary, falling back to original URL", uploadError);
                }
            }

            user = new User({
                email: email.toLowerCase(),
                // Use timestamp to ensure uniqueness (virtually zero collision chance)
                username: email.split('@')[0].substring(0, 10) + Date.now().toString().slice(-6),
                fullName: name,
                password: googleId,
                photos: finalPhoto ? [finalPhoto] : [], // Handle case where no photo exists
                isVerified: true,
                isProfileComplete: false,
                dateOfBirth: '2000-01-01',
                gender: undefined, // Force user to set this in onboarding
                interestedIn: undefined, // Force user to set this in onboarding
                location: undefined // Force user to set this in onboarding
            });
            await user.save();
        } else {
            user.lastActive = new Date();
            user.isOnline = true;
            await user.save();
        }

        res.json(user);

    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(401).json({ error: 'Invalid Google Token' });
    }
});

// Signup
router.post('/signup', async (req, res) => {
    try {
        const { email, username, photos } = req.body;

        // Check existing
        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }]
        });

        if (existingUser) {
            if (existingUser.email === email.toLowerCase()) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Process Photos: Upload Base64 to Cloudinary
        let processedPhotos = [];
        if (photos && Array.isArray(photos)) {
            try {
                const uploadPromises = photos.map(async (photo) => {
                    if (photo.startsWith('data:image')) {
                        // It's a base64 string, upload to Cloudinary
                        const result = await cloudinary.uploader.upload(photo, {
                            folder: 'velvii/users',
                            resource_type: 'image'
                        });
                        return result.secure_url;
                    }
                    return photo; // Already a URL (e.g. default)
                });
                processedPhotos = await Promise.all(uploadPromises);
            } catch (uploadError) {
                console.error("Cloudinary Upload Error:", uploadError);
                // Fallback: Proceed with original photos but warn? 
                // Or fail? Failing is safer to prevent broken profiles.
                return res.status(500).json({ error: 'Failed to upload profile photos' });
            }
        }

        const userData = {
            ...req.body,
            photos: processedPhotos.length > 0 ? processedPhotos : req.body.photos
        };

        const newUser = new User(userData);
        await newUser.save();

        res.status(201).json(newUser);
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Direct Admin Access Check (as per original code)
        if (email === 'admin@velvii.com' && password === 'velvii878') {
            // Return the special admin session object (not saved in DB)
            return res.json({
                id: 'admin-session',
                email: 'admin@velvii.com',
                fullName: 'Velvii Administrator',
                username: 'velvii_admin',
                isAdmin: true,
                // ... other minimal fields needed by frontend
                isPremium: true,
                dateOfBirth: '1990-01-01', // Default DOB for admin
                photos: ['https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&q=80']
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Simple password check (In production, use bcrypt!)
        // For migration, we assume plaintext passwords as per original seed data
        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Update last active
        user.lastActive = new Date();
        user.isOnline = true;
        await user.save();

        res.json(user);
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

module.exports = router;
