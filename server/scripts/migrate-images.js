/**
 * Migration Script: Base64 Images to Cloudinary
 * 
 * This script scans the database for base64 encoded images and migrates them to Cloudinary.
 * Collections checked:
 * - User.photos
 * - VerificationRequest.photos
 * - Message.content (where type === 'image')
 * 
 * Usage: node migrate-images.js
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

// Cloudinary Config
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'djv9chdo9',
    api_key: process.env.CLOUDINARY_API_KEY || '567472814886263',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'T2RPY8xv7IY3kOoXMP4tThpN_Zc'
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://velviiorg_db_user:lvqyDCYBapnMa67y@cluster0.hbnzuhp.mongodb.net/VelviiDB?appName=Cluster0";

// Helper: Check if string is base64 image
const isBase64Image = (str) => {
    if (!str || typeof str !== 'string') return false;
    return str.startsWith('data:image');
};

// Helper: Upload base64 to Cloudinary
const uploadToCloudinary = async (base64Data, folder = 'velvii/migrated') => {
    try {
        const result = await cloudinary.uploader.upload(base64Data, {
            folder,
            resource_type: 'image'
        });
        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload failed:', error.message);
        return null;
    }
};

// Migration Functions
async function migrateUserPhotos(User) {
    console.log('\n📷 Migrating User.photos...');
    const users = await User.find({});
    let migratedCount = 0;
    let errorCount = 0;

    for (const user of users) {
        if (!user.photos || user.photos.length === 0) continue;

        let modified = false;
        const newPhotos = [];

        for (const photo of user.photos) {
            if (isBase64Image(photo)) {
                console.log(`  → Migrating photo for user: ${user.email || user._id}`);
                const url = await uploadToCloudinary(photo, 'velvii/users');
                if (url) {
                    newPhotos.push(url);
                    modified = true;
                    migratedCount++;
                } else {
                    newPhotos.push(photo); // Keep original on failure
                    errorCount++;
                }
            } else {
                newPhotos.push(photo); // Already a URL
            }
        }

        if (modified) {
            user.photos = newPhotos;
            await user.save();
        }
    }

    console.log(`  ✅ User photos: ${migratedCount} migrated, ${errorCount} errors`);
}

async function migrateVerificationPhotos(VerificationRequest) {
    console.log('\n🔐 Migrating VerificationRequest.photos...');
    const requests = await VerificationRequest.find({});
    let migratedCount = 0;
    let errorCount = 0;

    for (const request of requests) {
        if (!request.photos || request.photos.length === 0) continue;

        let modified = false;
        const newPhotos = [];

        for (const photo of request.photos) {
            if (isBase64Image(photo)) {
                console.log(`  → Migrating verification photo for request: ${request._id}`);
                const url = await uploadToCloudinary(photo, 'velvii/verification');
                if (url) {
                    newPhotos.push(url);
                    modified = true;
                    migratedCount++;
                } else {
                    newPhotos.push(photo);
                    errorCount++;
                }
            } else {
                newPhotos.push(photo);
            }
        }

        if (modified) {
            request.photos = newPhotos;
            await request.save();
        }
    }

    console.log(`  ✅ Verification photos: ${migratedCount} migrated, ${errorCount} errors`);
}

async function migrateMessageImages(Message) {
    console.log('\n💬 Migrating Message images...');
    const messages = await Message.find({ type: 'image' });
    let migratedCount = 0;
    let errorCount = 0;

    for (const message of messages) {
        if (!message.content) continue;

        if (isBase64Image(message.content)) {
            console.log(`  → Migrating message image: ${message._id}`);
            const url = await uploadToCloudinary(message.content, 'velvii/messages');
            if (url) {
                message.content = url;
                await message.save();
                migratedCount++;
            } else {
                errorCount++;
            }
        }
    }

    console.log(`  ✅ Message images: ${migratedCount} migrated, ${errorCount} errors`);
}

// Main Execution
async function main() {
    console.log('🚀 Starting Image Migration to Cloudinary...');
    console.log('================================================\n');

    try {
        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Load Models
        const User = require('../models/User');
        const VerificationRequest = require('../models/VerificationRequest');
        const Message = require('../models/Message');

        // Run Migrations
        await migrateUserPhotos(User);
        await migrateVerificationPhotos(VerificationRequest);
        await migrateMessageImages(Message);

        console.log('\n================================================');
        console.log('🎉 Migration Complete!');
        console.log('================================================\n');

    } catch (error) {
        console.error('❌ Migration Failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('📡 MongoDB connection closed.');
        process.exit(0);
    }
}

main();
