const io = require("socket.io-client");

// Note: Ensure your server is running on localhost:3001
const SOCKET_URL = "http://localhost:3001";

console.log("Connecting to", SOCKET_URL, "...");
const socket = io(SOCKET_URL);

socket.on("connect", () => {
    console.log("✅ Connected to server with ID:", socket.id);

    // 1. Identify as a user
    socket.emit("add-user", "test-user-verify-ai");
});

socket.on("receive-message", (data) => {
    console.log("✅ RECEIVED RESPONSE FROM AI:");
    console.log("   Content:", data.content);
    console.log("   Sender:", data.senderId);
    console.log("🎉 AI Integration Logic Verified Success!");
    process.exit(0);
});

// Send message after small delay
setTimeout(() => {
    console.log("📤 Sending message to AI...");
    socket.emit("send-message", {
        senderId: "test-user-verify-ai",
        to: "ai-profile-999",
        content: "Hello, this is a test message. Are you working?",
        isAI: true,
        matchId: "test-match-123",
        id: "msg-test-" + Date.now(),
        type: "text",
        createdAt: new Date()
    });
}, 2000);

// Timeout
setTimeout(() => {
    console.error("❌ TIMEOUT: No response from AI within 15 seconds.");
    console.error("   Possible causes:");
    console.error("   1. GEMINI_API_KEY is missing/invalid.");
    console.error("   2. Backend threw an error (check server logs).");
    console.error("   3. AI simulated delay is too long.");
    process.exit(1);
}, 15000);
