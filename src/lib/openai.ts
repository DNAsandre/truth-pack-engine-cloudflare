/**
 * OpenAI Integration — Pure fetch() for Cloudflare Edge compatibility.
 * No SDK, no async_hooks, no Node.js dependencies.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Downloads audio from a public temp URL and transcribes it using Whisper.
 */
export async function transcribeAudioUrl(audioUrl: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

  // Fetch the audio file from Kapso's temporary URL
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
  }
  const audioBlob = await audioResponse.blob();

  // Build multipart form data for Whisper API
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.ogg');
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.text;
}

/**
 * Extracts structured data from raw transcript using GPT-4o.
 */
export async function extractTruthPackData(rawText: string, personaSchema: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an AI architect extracting intelligence into a Truth Pack structure. 
          Extract the knowledge from the provided text according to this focus summary:
          ${personaSchema}
          
          Do not include filler text. Ensure valid JSON.`
        },
        {
          role: 'user',
          content: `Here is the raw text to process: \n\n${rawText}`
        }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GPT-4o API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content || '{}';
}
