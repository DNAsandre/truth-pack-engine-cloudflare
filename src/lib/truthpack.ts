import fs from 'fs/promises';
import path from 'path';

export const SCHEMA_PROMPT = `
You are generating a Truth Pack architecture specification.
I need you to output your response in JSON format.
The JSON must have the following keys containing markdown-formatted strings:
- "clinicalProtocol": Focus on decision criteria, restrictions, optimal markers, workflows.
- "operationsExperience": Focus on the patient journey, touchpoints, commercial logic.
- "systemArchitecture": Focus on CRM needs, logistics, existing tech stack.

Write thorough, professional Markdown notes based on the provided transcription.
`;

export async function generateMarkdownTruthPack(extractedJsonString: string, projectId: string) {
  try {
    const data = JSON.parse(extractedJsonString);
    const directory = path.join(process.cwd(), 'truth-packs', projectId);

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });

    // Write the separate markdown files
    if (data.clinicalProtocol) {
      await fs.writeFile(path.join(directory, 'clinical-protocol.md'), data.clinicalProtocol);
    }
    if (data.operationsExperience) {
      await fs.writeFile(path.join(directory, 'operations-experience.md'), data.operationsExperience);
    }
    if (data.systemArchitecture) {
      await fs.writeFile(path.join(directory, 'system-architecture.md'), data.systemArchitecture);
    }

    console.log(`✅ Created Markdown Truth Pack in /truth-packs/${projectId}/`);
  } catch (error) {
    console.error("❌ Failed to generate Markdown Truth Pack files:", error);
  }
}
