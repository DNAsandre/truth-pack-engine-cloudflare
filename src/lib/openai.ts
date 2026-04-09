import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Downloads audio from a public temp URL and transcribes it using Whisper.
 */
export async function transcribeAudioUrl(audioUrl: string): Promise<string> {
  // Fetch the audio file
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio from Kapso URL: ${response.statusText}`);
  }

  // Get the Blob and create a File object required by the OpenAI SDK
  const blob = await response.blob();
  const file = new File([blob], 'audio.ogg', { type: blob.type || 'audio/ogg' });

  // Call OpenAI Whisper API
  const transcription = await openai.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
  });

  return transcription.text;
}

/**
 * Extracts structured data from raw transcript or text.
 */
export async function extractTruthPackData(rawText: string, personaSchema: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an AI architect extracting intelligence into a Truth Pack structure. 
        Extract the knowledge from the provided text according to this focus summary:
        ${personaSchema}
        
        Do not include filler text. Ensure valid JSON.`
      },
      {
        role: "user",
        content: `Here is the raw text to process: \n\n${rawText}`
      }
    ],
  });

  return completion.choices[0].message.content || "{}";
}
