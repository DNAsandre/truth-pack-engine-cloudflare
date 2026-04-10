export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const kapsoWebhookSchema = z.object({
  contact_id: z.string().optional(),
  phone_number: z.string().optional(),
  message_type: z.enum(['text', 'audio', 'image', 'document', 'interactive']).optional(),
  content: z.string().optional(),
  media_url: z.string().url().optional(),
  conversation_id: z.string().optional(),
}).passthrough();

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const payload = kapsoWebhookSchema.parse(rawBody);

    let finalExtractedText = payload.content || "";

    if (payload.message_type === 'audio' && payload.media_url) {
      const { transcribeAudioUrl } = await import('@/lib/openai');
      finalExtractedText = await transcribeAudioUrl(payload.media_url);
    }

    if (finalExtractedText) {
      const { extractTruthPackData } = await import('@/lib/openai');
      const { SCHEMA_PROMPT } = await import('@/lib/truthpack');
      const { upsertContact, addContactNote } = await import('@/lib/ghl');

      const contactId = await upsertContact(payload.phone_number || "Unknown Phone");
      if (contactId) {
          await addContactNote(contactId, `Raw Transcript Log:\n\n${finalExtractedText}`);
      }

      const structuredData = await extractTruthPackData(finalExtractedText, SCHEMA_PROMPT);

      if (contactId) {
          await addContactNote(contactId, `Truth Pack Structure:\n\n${structuredData}`);
      }
      
      // NOTE: Local Markdown generation (fs) is disabled on Cloudflare Edge Runtime.
      // Data is synced entirely to DNA Super Systems CRM for now.
    }

    return NextResponse.json({ success: true, processed: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Active on Cloudflare Edge" }, { status: 200 });
}
