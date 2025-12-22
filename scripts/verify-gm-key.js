const { GoogleGenerativeAI } = require("@google/generative-ai");

const key = process.argv[2];

if (!key) {
    console.error("Please provide an API key as an argument.");
    process.exit(1);
}

console.log(`Testing Key: ${key.substring(0, 10)}... (Model: gemini-2.0-flash)`);

async function testKey() {
    try {
        const genAI = new GoogleGenerativeAI(key);
        // Using "gemini-2.0-flash" as found in the list
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        console.log("SENDING REQUEST...");
        const result = await model.generateContent("Hello, are you working?");
        const response = result.response.text();

        console.log("✅ SUCCESS! AI Responded:");
        console.log(response);
    } catch (error) {
        console.error("❌ FAILED:");
        console.error(error.message);
    }
}

testKey();
