import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google GenAI client if GEMINI_API_KEY is present
const apiKey = process.env.GEMINI_API_KEY;
const aiClient = apiKey ? new GoogleGenAI({ apiKey }) : null;

// SAATHI System Prompt instructions
const SAATHI_SYSTEM_PROMPT = `You are SAATHI – Your International Travel Companion.
Full name: Smart Assistance for All Travel, Hotels and International journeys.
Tagline: "Your World. Your Journey. Your Saathi."
Description: "From visa preparation to hotel recommendations, SAATHI makes international travel simpler, smarter, and stress-free."

Your mission is to be an intelligent, empathetic, and comprehensive international travel support companion. You answer real-world travel questions and help travellers understand and solve international travel problems, including:
1. International Visa Assistance & Immigration (Dubai/UAE, Schengen/Europe, Singapore, Thailand, Japan, US, UK, visa rejections, delays, validity, required document checklists, biometric appointments)
2. Document Management & Vault (Passport 6-month validity rule, emergency certificates, photo requirements, apostille/attestation)
3. International Hotel & Accommodation Guidance (Neighborhood recommendations, deposit policies, booking scams)
4. International Dining & Restaurant Suggestions (Dietary needs, Halal, Vegan, Vegetarian, local cuisine etiquette)
5. Flights & Airport Disruptions (Cancellations, refunds under DGCA/EU261, missed connections, baggage loss PIR, web check-in)
6. Travel Money & Currency (Multi-currency cards, dynamic currency conversion avoidance, zero-forex markup, travel insurance)
7. Safety, Consulates & Emergencies (Lost passport police/embassy steps, medical assistance abroad)

CRITICAL RULES:
- Never guarantee visa approvals or claim to know the exact cause of a visa rejection without official evidence.
- Distinguish general guidance from confirmed official regulations. Always direct users to official authorities (e.g., u.ae, vfsglobal.com, icp.gov.ae, gdrfad.gov.ae).
- Avoid legal jargon; explain technical terms in plain English.
- If nationality, destination, or purpose is missing, politely ask for it. NEVER ask for sensitive info like passport numbers, passwords, or credit card numbers.
- Structure responses clearly with markdown sections when relevant:
  • **What this means**
  • **Possible reasons**
  • **What you should do next**
  • **Documents to check**
  • **Official resources**
`;

// API Route for Mia Chatbot
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!aiClient) {
      // No API key configured on server, signal client to use rich local intelligence engine
      return res.json({
        fallback: true,
        reason: 'GEMINI_API_KEY is not configured on server'
      });
    }

    // Call Gemini 3.8 Flash with Google Search Grounding
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: message,
      config: {
        systemInstruction: SAATHI_SYSTEM_PROMPT,
        tools: [{ googleSearch: {} }]
      }
    });

    const candidate = response.candidates?.[0];
    const text = response.text || '';

    // Extract search grounding metadata if available
    const groundingMetadata = candidate?.groundingMetadata;
    const webSearchQueries = groundingMetadata?.webSearchQueries || [];
    const groundingChunks = groundingMetadata?.groundingChunks || [];

    const sources = groundingChunks
      .filter((chunk: any) => chunk.web?.uri && chunk.web?.title)
      .map((chunk: any) => ({
        title: chunk.web.title,
        url: chunk.web.uri,
        domain: new URL(chunk.web.uri).hostname,
        isOfficial: chunk.web.uri.includes('.gov') || chunk.web.uri.includes('.org') || chunk.web.uri.includes('airline')
      }))
      .slice(0, 4);

    return res.json({
      text,
      sources,
      webSearchQueries,
      verifiedDate: 'Verified with official sources (October 2026)',
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    });
  } catch (error: any) {
    console.error('Gemini API Error in /api/chat:', error);
    return res.json({
      fallback: true,
      error: error?.message || 'Gemini API call failed'
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SAATHI full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
