/**
 * Truth Pack Engine — Cloudflare Worker (Pure Edge, No Next.js)
 * 
 * Receives WhatsApp webhook payloads from Kapso.ai,
 * transcribes audio via OpenAI Whisper, extracts structured
 * intelligence via GPT-4o, and syncs to DNA Super Systems CRM.
 */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (request.method === 'GET' && url.pathname === '/api/webhooks/kapso') {
      return Response.json({ status: 'active', engine: 'Truth Pack Engine v1.0', runtime: 'Cloudflare Worker' });
    }

    // Webhook endpoint
    if (request.method === 'POST' && url.pathname === '/api/webhooks/kapso') {
      return handleWebhook(request, env);
    }

    // Root health
    if (url.pathname === '/') {
      return Response.json({ message: 'Truth Pack Engine is running.' });
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  try {
    const body: any = await request.json();

    const phoneNumber = body.phone_number || 'Unknown';
    const content = body.content || '';
    const messageType = body.message_type || 'text';
    const mediaUrl = body.media_url || '';

    let finalText = content;

    // Step 1: Transcribe audio via Whisper if voice note
    if (messageType === 'audio' && mediaUrl) {
      const audioResponse = await fetch(mediaUrl);
      if (!audioResponse.ok) {
        return Response.json({ success: false, error: 'Failed to fetch audio from Kapso' }, { status: 400 });
      }
      const audioBlob = await audioResponse.blob();
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.ogg');
      formData.append('model', 'whisper-1');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
        body: formData,
      });

      if (whisperRes.ok) {
        const whisperData: any = await whisperRes.json();
        finalText = whisperData.text || '';
      } else {
        const errText = await whisperRes.text();
        return Response.json({ success: false, error: `Whisper failed: ${errText}` }, { status: 500 });
      }
    }

    if (!finalText) {
      return Response.json({ success: true, processed: false, reason: 'No text to process' });
    }

    // Step 2: Extract structured data via GPT-4o
    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
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
Do not include filler text. Ensure valid JSON.`,
          },
          { role: 'user', content: `Here is the raw text to process:\n\n${finalText}` },
        ],
      }),
    });

    let structuredData = '{}';
    if (gptRes.ok) {
      const gptData: any = await gptRes.json();
      structuredData = gptData.choices?.[0]?.message?.content || '{}';
    }

    // Step 3: Upsert contact in DNA Super Systems (GHL)
    const locationId = 'MMw2Q2m5APYUC8d0fGbB';
    let contactId: string | null = null;

    if (env.GHL_API_KEY) {
      // Create contact — if duplicate exists, GHL returns the existing contactId in the error
      const contactRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GHL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId,
          firstName: 'Truth Pack Client',
          phone: phoneNumber,
        }),
      });

      const contactData: any = await contactRes.json();

      if (contactRes.ok) {
        // New contact created
        contactId = contactData?.contact?.id || null;
      } else if (contactData?.statusCode === 400 && contactData?.meta?.contactId) {
        // Duplicate contact — grab existing ID from the error response
        contactId = contactData.meta.contactId;
      }

      // Step 4: Push raw transcript note
      if (contactId) {
        await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GHL_API_KEY}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: `Raw Transcript Log:\n\n${finalText}` }),
        });

        // Step 5: Push structured truth pack note
        await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GHL_API_KEY}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: `Truth Pack Structure:\n\n${structuredData}` }),
        });
      }
    }

    return Response.json({ success: true, processed: true, contactId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

interface Env {
  OPENAI_API_KEY: string;
  GHL_API_KEY: string;
}
