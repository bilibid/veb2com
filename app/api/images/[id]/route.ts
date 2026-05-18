import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const filePath = path.join('/tmp/gemini-images', `${id}.jpg`);
    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error("Error serving image:", error);
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
