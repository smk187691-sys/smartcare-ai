import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Razorpay from 'razorpay';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/api/health-check', (req, res) => {
  res.json({ status: 'ok', message: 'SmartCare Backend is running' });
});

app.post('/api/ai/analyze', async (req, res) => {
  const { prompt, systemInstruction, attachment, responseSchema } = req.body;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction,
    });

    const parts = [{ text: prompt }];
    if (attachment) {
      parts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.data,
        },
      });
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: responseSchema ? "application/json" : "text/plain",
        responseSchema: responseSchema,
      },
    });

    res.json({ text: result.response.text() });
  } catch (error) {
    console.error('AI Analysis Error:', error);
    res.status(500).json({ error: 'Failed to process AI request' });
  }
});

// --- MONETIZATION & ANALYTICS ENDPOINTS --- //

// 1. Razorpay Order Creation
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, currency } = req.body;
    
    // Fallback securely if API keys are missing during development testing
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
      key_secret: process.env.RAZORPAY_SECRET || 'dummy_secret',
    });

    const options = {
      amount: amount * 100, // Razorpay expects smallest currency unit (paise)
      currency: currency || "INR",
      receipt: `receipt_order_${Math.floor(Math.random() * 10000)}`,
    };
    
    // Simulate generation if we don't have real keys configured
    if (!process.env.RAZORPAY_KEY_ID) {
      console.log('Using simulated Razorpay order due to missing keys.');
      return res.json({ id: `order_mock_${Date.now()}`, amount: options.amount, currency: options.currency });
    }

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error('Razorpay Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Data Analytics / Reporting
const reportedCases = [];

app.post('/api/report', (req, res) => {
  const { type, location, data, timestamp } = req.body;
  reportedCases.push({ id: crypto.randomUUID(), type, location, data, timestamp: timestamp || new Date() });
  console.log(`[ANALYTICS] New ${type} report logged from location: ${JSON.stringify(location)}`);
  res.json({ success: true, message: `Report logged. Total reports: ${reportedCases.length}` });
});

app.listen(port, () => {
  console.log(`SmartCare backend listening at http://localhost:${port}`);
});
