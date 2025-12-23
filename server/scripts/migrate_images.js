const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log("Migration Script Started...");
console.log("MongoDB URI:", process.env.MONGO_URI ? "Found" : "Missing");
console.log("Cloudinary Config:", process.env.CLOUDINARY_CLOUD_NAME ? "Found" : "Missing");

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'djv9chdo9',
    api_key: process.env.CLOUDINARY_API_KEY || '567472814886263',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'T2RPY8xv7IY3kOoXMP4tThpN_Zc',
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://velviiorg_db_user:lvqyDCYBapnMa67y@cluster0.hbnzuhp.mongodb.net/VelviiDB?appName=Cluster0";

// Define Minimal Schemas (to avoid loading full app context if complex)
const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({}, { strict: false });
const Message = mongoose.model('Message', MessageSchema);

const uploadToCloudinary = async (base64Data, folder) => {
    try {
        const result = await cloudinary.uploader.upload(base64Data, {
            folder: `velvii/${folder}`,
            resource_type: 'image',
        });
        return result.secure_url;
    } catch (error) {
        console.error(`Upload failed for ${folder}:`, error.message);
        return null;
    }
};

const migrate = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB.");

        // --- USERS MIGRATION ---
        console.log("\n--- USER MIGRATION ---");
        const users = await User.find({});
        console.log(`Found ${users.length} users.`);

        for (const user of users) {
            let isModified = false;
            if (user.photos && Array.isArray(user.photos)) {
                const newPhotos = [];
                for (const photo of user.photos) {
                    // Check for potential base64 (starts with data:image or is very long)
                    if (typeof photo === 'string' && photo.startsWith('data:image')) {
                        console.log(`Migrating photo for user ${user.username || user._id}...`);
                        const url = await uploadToCloudinary(photo, 'profiles');
                        if (url) {
                            newPhotos.push(url);
                            isModified = true;
                        } else {
                            newPhotos.push(photo); // Keep original if fail
                        }
                    } else {
                        newPhotos.push(photo);
                    }
                }

                if (isModified) {
                    user.photos = newPhotos;
                    await user.save();
                    console.log(`User ${user.username || user._id} updated.`);
                }
            }
        }

        // --- MESSAGES MIGRATION ---
        console.log("\n--- MESSAGE MIGRATION ---");
        const messages = await Message.find({});
        console.log(`Found ${messages.length} messages.`);
        let msgCount = 0;

        for (const msg of messages) {
            // Check if content is base64 image
            if (typeof msg.content === 'string' && msg.content.startsWith('data:image')) {
                console.log(`Migrating message ${msg._id}...`);
                const url = await uploadToCloudinary(msg.content, 'messages');
                if (url) {
                    msg.content = url;
                    msg.type = 'image'; // Ensure type is image
                    await msg.save();
                    msgCount++;
                }
            }
        }
        console.log(`Updated ${msgCount} messages.`);

        console.log("\nMigration Complete! ✅");
        process.exit(0);

    } catch (error) {
        console.error("Migration Error:", error);
        process.exit(1);
    }
};

migrate();
