import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Express route for AI Chatbot
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, userRole, courseContext } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is missing on the server. Please check settings.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `You are DeepSeek V4.1 Flash, the official AI Student Learning Assistant for Swanaya Media Academy.
Swanaya Media Academy is a premier EdTech and Media Science institute offering programs like Advanced Diploma in AI Business & Digital Media, Advanced Diploma in Digital Journalism, Advanced Diploma in Data Analytics & Media Science, Graphic Design & Motion VFX, Film Direction & Scriptwriting.

Your mission:
- Provide supportive, intelligent, clear, and actionable learning guidance to students.
- Help students with course syllabus questions, assignment planning, code syntax, project portfolio strategies, exam prep, and media industry trends.
- Use encouraging, professional, and clear tone with rich markdown formatting (bullet points, bold text, code blocks).
- Context: Student is currently studying ${courseContext || 'Digital Media & Tech'} at Swanaya Media Academy.
`;

    // Format chat history for GoogleGenAI SDK
    const contents = (messages || []).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const replyText = response.text || "I'm here to help! Could you clarify your question about your studies?";
    return res.json({ reply: replyText });
  } catch (error: any) {
    console.error('Error in /api/ai/chat:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate AI response. Please try again.'
    });
  }
});

// Vite middleware integration for full-stack dev execution
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
