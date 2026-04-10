export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    const GHL_KEY = process.env.GHL_API_KEY;

    const phoneNumber = body.phone_number || "Unknown";
    const content = body.content || "";
    const messageType = body.message_type || "text";
    const mediaUrl = body.media_url || "";
    const conversationId = body.conversation_id || "general";

    let finalText = content;

    // Step 1: Transcribe audio via Whisper if needed
    if (messageType === 'audio' && mediaUrl) {
      const audioResponse = await fetch(mediaUrl);
      if (!audioResponse.ok) {
        return Response.json({ success: false, error: "Failed to fetch audio" }, { status: 400 });
      }
      const audioBlob = await audioResponse.blob();
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.ogg');
      formData.append('model', 'whisper-1');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: formData,
      });

      if (whisperRes.ok) {
        const whisperData = await whisperRes.json();
        finalText = whisperData.text || "";
      }
    }

    if (!finalText) {
      return Response.json({ success: true, processed: false, reason: "No text to process" });
    }

    // Step 2: Extract structured data via GPT-4o
    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an AI architect extracting intelligence into a Truth Pack structure.
Extract the knowledge from the provided text into JSON with these keys:
- "clinicalProtocol": clinical decision criteria, restrictions, optimal markers, workflows
- "operationsExperience": patient journey, touchpoints, commercial logic
- "systemArchitecture": CRM needs, logistics, existing tech stack
Do not include filler text. Ensure valid JSON.`
          },
          { role: 'user', content: `Here is the raw text to process:\n\n${finalText}` }
        ],
      }),
    });

    let structuredData = "{}";
    if (gptRes.ok) {
      const gptData = await gptRes.json();
      structuredData = gptData.choices?.[0]?.message?.content || "{}";
    }

    // Step 3: Upsert contact in DNA Super Systems
    const locationId = "MMw2Q2m5APYUC8d0fGbB";
    let contactId: string | null = null;

    if (GHL_KEY) {
      const contactRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId,
          firstName: "Truth Pack Client",
          phone: phoneNumber,
        }),
      });

      if (contactRes.ok) {
        const contactData = await contactRes.json();
        contactId = contactData?.contact?.id || null;
      }

      // Step 4: Push raw transcript note
      if (contactId) {
        await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GHL_KEY}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: `Raw Transcript Log:\n\n${finalText}` }),
        });

        // Step 5: Push structured truth pack note
        await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GHL_KEY}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: `Truth Pack Structure:\n\n${structuredData}` }),
        });
      }
    }

    return Response.json({ success: true, processed: true, contactId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ status: "active", engine: "Truth Pack Engine v1.0", runtime: "Cloudflare Edge" });
}
