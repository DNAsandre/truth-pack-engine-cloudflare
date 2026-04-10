export const SCHEMA_PROMPT = `
You are generating a Truth Pack architecture specification.
I need you to output your response in JSON format.
The JSON must have the following keys containing markdown-formatted strings:
- "clinicalProtocol": Focus on decision criteria, restrictions, optimal markers, workflows.
- "operationsExperience": Focus on the patient journey, touchpoints, commercial logic.
- "systemArchitecture": Focus on CRM needs, logistics, existing tech stack.

Write thorough, professional Markdown notes based on the provided transcription.
`;
