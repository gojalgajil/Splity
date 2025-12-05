const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;

console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'Not found');

if (!apiKey) {
  console.error('Error: NEXT_PUBLIC_GOOGLE_AI_API_KEY is not set in .env.local');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testGemini() {
  try {
    console.log('Initializing model...');
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    console.log('Sending test prompt...');
    const result = await model.generateContent("Hello, how are you?");
    const response = await result.response;
    const text = response.text();
    
    console.log('Success! Response:', text);
  } catch (error) {
    console.error('Error testing Gemini API:');
    console.error(error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testGemini();
