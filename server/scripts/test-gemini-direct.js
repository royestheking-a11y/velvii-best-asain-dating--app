const { GoogleGenerativeAI } = require("@google/generative-ai");

// The key we just updated in index.js
const USER_PROVIDED_KEY = "AIzaSyBIYhHw_G6tnYvgMb_sgDpwKqTZG-Mlh60";

async function testGemini() {
    console.log("----------------------------------------");
    console.log("🧪 Testing Gemini API Integration");
    console.log("🔑 Key:", USER_PROVIDED_KEY.substring(0, 10) + "...");
    console.log("----------------------------------------");

    try {
        const genAI = new GoogleGenerativeAI(USER_PROVIDED_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = "Reply to this dating app message as a human: 'Hey, how are you?'";

        console.log(`📤 Sending prompt: "${prompt}"`);
        const result = await model.generateContent(prompt);
        const response = result.response.text();

        console.log("----------------------------------------");
        console.log("✅ SUCCESS! AI Replied:");
        console.log(`"${response}"`);
        console.log("----------------------------------------");
        return true;
    } catch (error) {
        console.error("----------------------------------------");
        console.error("❌ FAILED:", error.message);
        if (error.response) {
            console.error("Details:", JSON.stringify(error.response, null, 2));
        }
        console.error("----------------------------------------");
        return false;
    }
}

testGemini();
