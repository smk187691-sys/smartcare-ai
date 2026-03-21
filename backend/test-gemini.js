import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.VITE_API_KEY });
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{text: 'Hello, what is your name?'}]
    });
    console.log("SUCCESS:", res.text);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

test();
