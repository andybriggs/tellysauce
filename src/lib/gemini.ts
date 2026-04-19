/** Shared types for Gemini model API responses */

export type ModelPart = { text?: string };
export type ModelContent = { parts?: ModelPart[] };
export type ModelCandidate = {
  content?: ModelContent;
  finishReason?: string | null;
};
export type ModelResponse = {
  candidates?: ModelCandidate[];
  promptFeedback?: { blockReason?: string | null };
  text?: string; // some Gemini SDK responses surface .text on structuring runs
};
