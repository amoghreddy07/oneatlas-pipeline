import { AppIntent } from '@/types';
import { ROUTING_CONFIG } from '../modelConfig';
import { callChain, cleanJSON } from '../providers/gateway';

const SYSTEM_PROMPT = `You are an intent extraction engine.
Given a user's app description, extract structured intent.
Respond ONLY with valid JSON, no explanation, no markdown.

Output this exact structure:
{
  "appName": "string",
  "appType": "crm | project_management | ecommerce | hr_tool | inventory | content_platform | analytics | custom",
  "features": ["string"],
  "entities": ["string"],
  "integrations_requested": ["string"],
  "assumptions": ["string"]
}

Rules:
- If prompt is vague (under 10 meaningful words), add clarification_required: { flag: true, question: "one specific question" }
- Always include tenantId as an assumption
- integrations_requested should be lowercase (slack, stripe, whatsapp etc)`;

export async function extractIntent(prompt: string): Promise<{
  intent: AppIntent;
  tokensUsed: number;
  cost: number;
  provider: string;
}> {
  const routing = ROUTING_CONFIG.intent_extraction;
  const response = await callChain(routing, SYSTEM_PROMPT, prompt);
  const clean = cleanJSON(response.content);

  try {
    const intent = JSON.parse(clean) as AppIntent;
    return { intent, tokensUsed: response.tokensUsed, cost: response.cost, provider: response.provider };
  } catch {
    const correctionPrompt = `Your previous response was not valid JSON.
Original prompt: ${prompt}
Return ONLY valid JSON with no markdown or explanation.`;
    const retry = await callChain(routing, SYSTEM_PROMPT, correctionPrompt);
    const intent = JSON.parse(cleanJSON(retry.content)) as AppIntent;
    return { intent, tokensUsed: response.tokensUsed + retry.tokensUsed, cost: response.cost + retry.cost, provider: retry.provider };
  }
}