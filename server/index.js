const express = require('express');
const app = express();
const http = require('http');
const cors = require('cors');
const { Server } = require("socket.io");

const mongoose = require('mongoose');
require('dotenv').config();

app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'https://velvii-best-asain-dating-app.vercel.app',
        process.env.FRONTEND_URL, // Vercel deployment URL
        process.env.VITE_API_URL  // Just in case
    ].filter(Boolean), // Remove undefined
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// PUSH NOTIFICATION SETUP
const webpush = require('web-push');
const publicVapidKey = process.env.PUBLIC_VAPID_KEY;
const privateVapidKey = process.env.PRIVATE_VAPID_KEY;

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        'mailto:support@velvii.com',
        publicVapidKey,
        privateVapidKey
    );
    console.log("✅ WebPush Configured");
} else {
    console.warn("⚠️ WebPush VAPID Keys missing in .env");
}

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://velviiorg_db_user:lvqyDCYBapnMa67y@cluster0.hbnzuhp.mongodb.net/VelviiDB?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/actions', require('./routes/actions'));
app.use('/api/notifications', require('./routes/notifications'));

const server = http.createServer(app);

// Allow connection from frontend (usually localhost:5173 or 5174)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store mapped users: { userId: "123", socketId: "abc" }
let activeUsers = [];
let simulatedActiveAI = new Map(); // Store { userId: "id", expiresAt: timestamp }

const broadcastUsers = () => {
    const aiUsers = Array.from(simulatedActiveAI.keys()).map(id => ({ userId: id, socketId: 'ai_simulated_' + id }));
    console.log(`[SERVER] Broadcasting users: ${activeUsers.length} real, ${aiUsers.length} AI`);
    if (aiUsers.length > 0) console.log(`[SERVER] AI Online: ${aiUsers.map(u => u.userId).join(', ')}`);
    io.emit("get-users", [...activeUsers, ...aiUsers]);
};

// Periodic cleanup of expired AI status
setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [id, expires] of simulatedActiveAI.entries()) {
        if (now > expires) {
            simulatedActiveAI.delete(id);
            changed = true;
        }
    }
    if (changed) broadcastUsers();
}, 60000); // Check every minute

io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // When a user logs in on frontend
    socket.on("add-user", async (newUserId) => {
        if (!newUserId) return;
        // Remove existing entry if any
        activeUsers = activeUsers.filter((user) => user.userId !== newUserId);
        // Add new entry with current socket
        activeUsers.push({ userId: newUserId, socketId: socket.id });
        console.log(`User Registered: ${newUserId} -> ${socket.id}`);
        broadcastUsers();

        // Update DB: Online
        try {
            const User = require('./models/User');
            await User.findByIdAndUpdate(newUserId, { isOnline: true });
        } catch (err) {
            console.error("Error updating online status:", err);
        }
    });

    socket.on("disconnect", async () => {
        // Find user before removing
        const user = activeUsers.find((u) => u.socketId === socket.id);

        activeUsers = activeUsers.filter((u) => u.socketId !== socket.id);
        broadcastUsers();

        if (user) {
            console.log(`User Disconnected: ${user.userId}`);
            // Update DB: Offline + Last Active
            try {
                const User = require('./models/User');
                await User.findByIdAndUpdate(user.userId, {
                    isOnline: false,
                    lastActive: new Date()
                });
            } catch (err) {
                console.error("Error updating offline status:", err);
            }
        }
    });

    // Chat Message Handler
    socket.on("send-message", async (data) => {
        const { to, isAI } = data; // Client MUST pass isAI: true if target is AI
        const user = activeUsers.find((u) => u.userId === to);

        // 1. Send to real user/device (if online)
        if (user) {
            io.to(user.socketId).emit("receive-message", data);
        } else if (isAI) {
            // 2. If it's an AI (even if "offline" logically, they are always "online"), trigger reply
            // We need the SENDER's socket ID to reply to them.
            // `socket.id` is the Sender's socket because they emitted this event.
            // PASS matchId and messageId (data.id) for persistence and read receipts
            await handleAIResponse(data.content, to, socket.id, data.senderId, data.matchId, data.id);
        } else {
            // 3. User is OFFLINE -> Send Push Notification
            console.log(`[SERVER] User ${to} is offline. Attempting Push Notification...`);
            const Subscription = require('./models/Subscription');
            const subscriptions = await Subscription.find({ userId: to });

            if (subscriptions.length > 0) {
                const payload = JSON.stringify({
                    title: data.senderName || 'New Message',
                    body: data.content,
                    icon: '/pwa-192x192.png',
                    url: `/messages/${data.matchId}`
                });

                Promise.all(subscriptions.map(sub =>
                    webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: sub.keys },
                        payload
                    ).catch(err => console.error("[PUSH] Failed", err))
                ));
            }
        }
    });

    // Message Update (for editing/status changes)
    socket.on("update-message", (data) => {
        const { to, messageId, updates } = data;
        const user = activeUsers.find((u) => u.userId === to);
        console.log(`[SERVER] Update Message ${messageId} for ${to}`);
        if (user) {
            io.to(user.socketId).emit("update-message", { messageId, updates });
        }
    });

    // --- Global Notification System ---
    socket.on("send-notification", (data) => {
        const { to, notification } = data; // content: { title, message, type, ... }
        const user = activeUsers.find((u) => u.userId === to);
        if (user) {
            console.log(`[SERVER] Sending notification to ${to}: ${notification.title}`);
            io.to(user.socketId).emit("receive-notification", notification);
        } else {
            // User OFFLINE -> Push
            const Subscription = require('./models/Subscription');
            Subscription.find({ userId: to }).then(subscriptions => {
                if (subscriptions.length > 0) {
                    const payload = JSON.stringify({
                        title: notification.title,
                        body: notification.message,
                        icon: '/pwa-192x192.png',
                        url: '/connect' // Default
                    });
                    const notifications = subscriptions.map(sub =>
                        webpush.sendNotification(sub, payload).catch(e => console.error("[PUSH] Err", e))
                    );
                    Promise.all(notifications);
                }
            });
        }
    });

    // --- Call Request / Permission Events (Phase 2 Upgrade) ---

    // A. Request Permission
    socket.on("request-voice-permission", (data) => {
        const { to, from, name } = data;
        console.log(`[SERVER] Permission request from ${from} to ${to}`);
        const user = activeUsers.find((u) => u.userId === to);

        if (user) {
            console.log(`[SERVER] User ${to} found at socket ${user.socketId}. Sending request...`);
            io.to(user.socketId).emit("voice-permission-requested", { from, name });
        } else {
            console.log(`[SERVER] User ${to} NOT FOUND in active users.`);
            console.log("Active Users:", activeUsers.map(u => u.userId));
        }
    });

    // B. Permission Accepted
    socket.on("voice-permission-accepted", (data) => {
        const { to, from } = data; // 'to' = requester, 'from' = approver (we trust client now)
        const targetUser = activeUsers.find((u) => u.userId === to);

        console.log(`Permission ACCEPTED by ${from} for ${to}`);

        if (targetUser) {
            // Update Match in DB
            // We need matchId. Client often doesn't pass it in 'voice-permission-accepted' event standardly?
            // If not available, we have to find match by users.
            const Match = require('./models/Match');
            Match.findOne({
                $or: [
                    { user1Id: from, user2Id: to },
                    { user1Id: to, user2Id: from }
                ]
            }).then(match => {
                if (match) {
                    match.voiceCallEnabled = true;
                    match.save();
                }
            });

            // Forward the approval to the requester so they can enable the call button
            io.to(targetUser.socketId).emit("voice-permission-granted", { from: from });
        }
    });

    // C. Permission Rejected
    socket.on("voice-permission-rejected", (data) => {
        const { to, from } = data;
        const targetUser = activeUsers.find((u) => u.userId === to);

        console.log(`Permission REJECTED by ${from} for ${to}`);

        if (targetUser) {
            io.to(targetUser.socketId).emit("voice-permission-denied", { from: from });
        }
    });

    // --- Call Signaling Events ---

    // 1. Caller initiates call (Only after permission if enforced on client)
    // 1. Caller initiates call (Only after permission if enforced on client)
    socket.on("call-user", (data) => {
        const { userToCall, signalData, from, name, image } = data; // Relaying image
        const user = activeUsers.find((u) => u.userId === userToCall);

        console.log(`Call from ${from} to ${userToCall}`);

        if (user) {
            io.to(user.socketId).emit("call-made", { signal: signalData, from, name, image }); // Passing image
        } else {
            // User offline
            // Maybe emit "user-offline"
        }
    });

    // 2. Callee answers
    socket.on("answer-call", (data) => {
        const { signal, to } = data;
        const user = activeUsers.find((u) => u.userId === to);

        console.log(`Answer from callee to ${to}`);

        if (user) {
            io.to(user.socketId).emit("call-answered", { signal });
        }
    });

    // 3. Reject Call
    socket.on("reject-call", (data) => {
        const { to } = data;
        const user = activeUsers.find((u) => u.userId === to);
        if (user) {
            io.to(user.socketId).emit("call-rejected");
        }
    });

    // 5. End Call (Clean Termination)
    socket.on("end-call", (data) => {
        const { to } = data;
        const user = activeUsers.find((u) => u.userId === to);
        if (user) {
            console.log(`Call ENDED by ${socket.id} for ${to}`);
            io.to(user.socketId).emit("call-ended");
        }
    });

    // 4. ICE Candidates
    socket.on("ice-candidate", (data) => {
        const { candidate, to } = data;
        const user = activeUsers.find((u) => u.userId === to);
        if (user) {
            io.to(user.socketId).emit("ice-candidate", { candidate });
        }
    });
});

const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- GEMINI AI CONFIGURATION ---
// --- GEMINI AI CONFIGURATION ---
const API_KEYS = (process.env.GEMINI_API_KEY || "").split(',').filter(k => k.trim());

let keyIndex = 0;
const getGeminiModel = () => {
    if (API_KEYS.length === 0) {
        console.error("[GEMINI] No API Keys found in GEMINI_API_KEY env var!");
        return null;
    }
    const key = API_KEYS[keyIndex];
    keyIndex = (keyIndex + 1) % API_KEYS.length;
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: "gemini-flash-latest" });
};

// AI Personas Configuration (You should map these to specific AI User IDs if possible)
// Since we don't have IDs here, we'll assign random personas based on gender or context if available.
// For now, generic Male/Female behavior.
const AI_BEHAVIOR = {
    male: "You are a charming, respectful man aged 25-30. Start as a friendly acquaintance, showing genuine interest. As the conversation progresses, become more flirtatious and boyfriend-material. Be concise, act purely human, never mention being an AI. If asked, you are from Dhaka.",
    female: "You are a sweet, intelligent woman aged 23-28. Start as a shy but friendly girl. Gradually become more affectionate and girlfriend-like. Be concise, act purely human, never mention being an AI. If asked, you are from Dhaka."
};

// Fallback Messages
const FALLBACK_ENGLISH = "now i'm busy talk to you later";
const FALLBACK_BANGLISH = "Ami ekhon ektu busy. Poray kotha bolbo";

// Check if text is likely Banglish
const isBanglish = (text) => {
    const banglishKeywords = ['ami', 'tumi', 'kemon', 'korcho', 'achho', 'kothay', 'ki', 'bolo', 'na', 'hobe', 'jai', 'khabar', 'sleep', 'love', 'baby'];
    return banglishKeywords.some(word => text.toLowerCase().includes(word));
};

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING on port ${PORT}`);
    console.log("------------------------------------------");
    console.log("🚀 GEMINI AI SYSTEM ACTIVATED");
    console.log("🔑 Loaded 12 API Keys");
    console.log("🤖 Personas: Male/Female with Banglish Support");
    console.log("------------------------------------------");
});

// --- AI RESPONSE HANDLER ---
const handleAIResponse = async (userMessage, aiUserId, userSocketId, originalSenderId, matchId, userMessageId) => {
    try {
        console.log(`[GEMINI] 🤖 Processing AI response for ${aiUserId}...`);

        // 0. SIMULATE ONLINE STATUS
        // Set online for 5 minutes
        const cleanAiId = aiUserId.trim();
        simulatedActiveAI.set(cleanAiId, Date.now() + 5 * 60 * 1000);

        // Broadcast to everyone
        broadcastUsers();

        // FORCE UPDATE to the sender immediately (redundancy)
        const currentAiUsers = Array.from(simulatedActiveAI.keys()).map(id => ({ userId: id, socketId: 'ai_simulated_' + id }));
        const allUsersList = [...activeUsers, ...currentAiUsers];
        io.to(userSocketId).emit("get-users", allUsersList);
        console.log(`[GEMINI] Forced status update to ${userSocketId} for AI ${cleanAiId}`);

        // 1. Simulate "Read" receipt faster
        setTimeout(() => {
            console.log(`[GEMINI] 👀 Marking message ${userMessageId} as read`);
            io.to(userSocketId).emit("update-message", {
                messageId: userMessageId,
                updates: { isRead: true }
            });
        }, 100); // Reduced drastically to 100ms for instant feel

        const model = getGeminiModel();

        if (!model) {
            console.error("[GEMINI] ❌ API Key missing or invalid.");
            throw new Error("Gemini Model Initialization Failed");
        }

        console.log(`[GEMINI] 🤖 Using Model: ${model.model}`);

        // Determine Gender/Persona
        const isMale = aiUserId.charCodeAt(aiUserId.length - 1) % 2 !== 0;
        const persona = isMale ? AI_BEHAVIOR.male : AI_BEHAVIOR.female;

        const systemPrompt = persona +
            `\nThe user says: "${userMessage}".\n` +
            `Reply concisely (1-2 sentences). Detect if user speaks English or Banglish/Bengali. If Banglish, reply in Banglish. If English, reply in English. NEVER start with a dot.`;

        console.log(`[GEMINI] 📤 Sending Prompt to ${model.model}...`);

        const result = await model.generateContent(systemPrompt);
        const response = result.response.text();

        if (!response || response.trim() === '.' || response.length < 2) {
            throw new Error("Invalid/Empty AI response");
        }

        console.log(`[GEMINI] ✅ Generated Response: "${response}"`);

        setTimeout(async () => {
            // SAVE TO DB
            const Message = require('./models/Message'); // Lazy import
            const aiMsg = new Message({
                id: Date.now().toString() + "-" + Math.random().toString(36).substr(2, 9),
                matchId: matchId,
                senderId: aiUserId,
                receiverId: originalSenderId,
                content: response,
                type: 'text',
                isRead: false,
                createdAt: new Date()
            });
            await aiMsg.save();

            // Update Match Last Message
            const Match = require('./models/Match');
            await Match.findOneAndUpdate(
                { id: matchId },
                {
                    lastMessageAt: new Date(),
                    $inc: { unreadCount1: 1 }
                }
            );

            console.log(`[GEMINI] 📨 Sending reply to socket ${userSocketId} (Match: ${matchId})`);
            io.to(userSocketId).emit("receive-message", aiMsg);

        }, 200 + Math.random() * 500); // Reduced to 0.2s - 0.7s

    } catch (error) {
        console.error("[GEMINI] ❌ FATAL ERROR:", error);
        if (error.status) console.error("   -> Error Status:", error.status);
        if (error.statusText) console.error("   -> Error Text:", error.statusText);
        if (error.errorDetails) console.error("   -> Details:", JSON.stringify(error.errorDetails));

        const isBanglishText = isBanglish(userMessage);
        const fallbackText = isBanglishText ? FALLBACK_BANGLISH : FALLBACK_ENGLISH;

        console.log(`[GEMINI] ⚠️ Using Fallback: "${fallbackText}"`);

        setTimeout(() => {
            io.to(userSocketId).emit("receive-message", {
                id: Date.now().toString() + "-" + Math.random().toString(36).substr(2, 9),
                matchId: matchId || "ai_match_" + Date.now(),
                senderId: aiUserId,
                receiverId: originalSenderId,
                content: fallbackText,
                type: 'text',
                isRead: false,
                isDelivered: true,
                createdAt: new Date().toISOString()
            });
        }, 2000);
    }
};

// Update send-message to trigger AI
const originalSendMessage = (data) => { /* logic */ };
// We override the socket listener inside connection block
