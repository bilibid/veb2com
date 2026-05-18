import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
     const apiKey = process.env.GEMINI_API_KEY;
     if (!apiKey) {
       console.error("GEMINI_API_KEY is not set.");
       return NextResponse.json({ error: "API key not configured." }, { status: 500 });
     }
     
     const ai = new GoogleGenAI({ 
       apiKey,
       httpOptions: {
         headers: {
           'User-Agent': 'aistudio-build',
         }
       }
     });
     const { contents } = await req.json();
     
     if (!contents || !Array.isArray(contents)) {
       return NextResponse.json({ error: "Invalid contents format." }, { status: 400 });
     }
     
     // Gemini API requires that consecutive messages do not have the same role
     const collapsedContents: any[] = [];
     for (const msg of contents) {
       const last = collapsedContents[collapsedContents.length - 1];
       if (last && last.role === msg.role) {
          last.parts.push({ text: "\n" });
          last.parts.push(...msg.parts);
       } else {
          collapsedContents.push({ role: msg.role, parts: [...msg.parts] });
       }
     }
     
     const response = await ai.models.generateContent({
       model: "gemini-3.1-pro-preview",
       contents: collapsedContents,
       config: {
         systemInstruction: `You are @Gemini, an AI participant in a group chat with multiple humans. 
You can see their email addresses in the prompt when they speak (e.g. 'user@gmail.com said: ').
Your task is to communicate naturally, helpfully, and actively build personality profiles of the users based on their inputs to tailor your responses and predict their perspectives on topics discussed. Do not format your response with 'Gemini said:', just respond directly as yourself. Keep responses concise unless asked for detail.`
       }
     });

     return NextResponse.json({ text: response.text });
  } catch (error: any) {
     console.error("Gemini API Error:", error.message, error.stack);
     return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
}
