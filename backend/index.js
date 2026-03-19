import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

app.listen(port, () => {
  console.log(`SmartCare backend listening at http://localhost:${port}`);
});
