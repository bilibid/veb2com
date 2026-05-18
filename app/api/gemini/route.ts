import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const generateImageFn: FunctionDeclaration = {
  name: "generateImage",
  description: "Generate an image based on a prompt and return the image data. Use this when the user explicitly asks for an image to be generated or drawn.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: "The detailed prompt to generate the image."
      }
    },
    required: ["prompt"]
  }
};

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
         tools: [
            { googleSearch: {} },
            { functionDeclarations: [generateImageFn] }
         ],
         toolConfig: { includeServerSideToolInvocations: true },
         systemInstruction: `You are @Gemini, an AI participant in a group chat with multiple humans. 
You can see their email addresses in the prompt when they speak (e.g. 'user@gmail.com said: ').
Your task is to communicate naturally, helpfully, and actively build personality profiles of the users based on their inputs to tailor your responses and predict their perspectives on topics discussed. Do not format your response with 'Gemini said:', just respond directly as yourself. Keep responses concise unless asked for detail. For recent info, use googleSearch. To create images, use the generateImage tool.`
       }
     });

     let text = response.text || "";
     
     if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
           if (call.name === 'generateImage') {
              const promptArgs = call.args?.prompt as string;
              if (promptArgs) {
                 try {
                   const imageReq = await ai.models.generateContent({
                      model: 'gemini-3.1-flash-image-preview',
                      contents: { parts: [{ text: promptArgs }] },
                      config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
                   });
                   let base64 = null;
                   const parts = imageReq.candidates?.[0]?.content?.parts;
                   if (parts && parts.length > 0) {
                     for (const p of parts) {
                        if (p.inlineData) {
                           base64 = p.inlineData.data;
                           break;
                        }
                     }
                   }
                   if (base64) {
                      try {
                        const id = crypto.randomUUID();
                        await fs.mkdir('/tmp/gemini-images', { recursive: true });
                        await fs.writeFile(path.join('/tmp/gemini-images', `${id}.jpg`), base64, 'base64');
                        text += `\n\n![Generated Image](/api/images/${id})`;
                        text += `\n*Generated image for: ${promptArgs}*`;
                      } catch (fsErr) {
                        console.error("Failed to write image to /tmp:", fsErr);
                        text += `\n\n*(Failed to save generated image)*`;
                      }
                   } else {
                      text += `\n\n*(Failed to generate image for: ${promptArgs})*`;
                   }
                 } catch(imgErr) {
                   console.error("Image generation error:", imgErr);
                   text += `\n\n*(Failed to generate image: API error)*`;
                 }
              }
           }
        }
     }
     
     const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
     if (groundingChunks && groundingChunks.length > 0) {
        text += "\n\n**Sources:**\n";
        groundingChunks.forEach(chunk => {
           if (chunk.web && chunk.web.uri) {
              text += `- [${chunk.web.title || chunk.web.uri}](${chunk.web.uri})\n`;
           }
        });
     }

     return NextResponse.json({ text });
  } catch (error: any) {
     console.error("Gemini API Error:", error.message, error.stack);
     return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
}
