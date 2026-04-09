import { NextResponse } from 'next/server';
import { z } from 'zod';

// Define the expected schema from the Kapso / WhatsApp Webhook
const kapsoWebhookSchema = z.object({
  contact_id: z.string().optional(),
  phone_number: z.string().optional(),
  message_type: z.enum(['text', 'audio', 'image', 'document', 'interactive']).optional(),
  content: z.string().optional(), // For text or audio URL
  media_url: z.string().url().optional(), // If Kapso sends media as a separate URL
  conversation_id: z.string().optional(),
}).passthrough(); // Allow extra fields we aren't explicitly parsing yet

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    
    // Validate payload structure
    const payload = kapsoWebhookSchema.parse(rawBody);
    console.log("📥 Received Kapso Webhook Payload:", JSON.stringify(payload, null, 2));

    let finalExtractedText = payload.content || "";

    // 1. Process Audio with Whisper if needed
    if (payload.message_type === 'audio' && payload.media_url) {
      console.log("🎵 Audio payload detected. Transcribing...");
      // Await transcription from the OpenAI utility
      const { transcribeAudioUrl } = await import('@/lib/openai');
      finalExtractedText = await transcribeAudioUrl(payload.media_url);
      console.log("✅ Transcription Complete:", finalExtractedText);
    }

    // 2. Extract into Truth Pack if we have text
    if (finalExtractedText) {
      const { extractTruthPackData } = await import('@/lib/openai');
      const { SCHEMA_PROMPT, generateMarkdownTruthPack } = await import('@/lib/truthpack');
      const { upsertContact, addContactNote } = await import('@/lib/ghl');

      // Sync to DNA Super Systems CRM immediately 
      const contactId = await upsertContact(payload.phone_number || "Unknown Phone");
      if (contactId) {
          await addContactNote(contactId, `Raw Transcript Log:\n\n${finalExtractedText}`);
      }

      // Structure the data based on our defined Schema
      const structuredData = await extractTruthPackData(finalExtractedText, SCHEMA_PROMPT);
      console.log("🧠 Structured Truth Pack Data Generated.");

      // Push structured note to CRM for Operations
      if (contactId) {
          await addContactNote(contactId, `Truth Pack Structure:\n\n${structuredData}`);
      }

      // Phase 4: Create the Markdown Files for the Engineers/AI Agents
      await generateMarkdownTruthPack(structuredData, payload.conversation_id || "general-project");
    }

    return NextResponse.json({ success: true, processed: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Kapso Webhook Error:", error);
    return NextResponse.json({ success: false, error: "Processing Error" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Kapso Webhook Endpoint Active" }, { status: 200 });
}
