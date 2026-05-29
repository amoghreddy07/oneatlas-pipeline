import { DataSchema, AppSpec, AppIntent } from '@/types';
import { ROUTING_CONFIG } from '../modelConfig';
import { callChain, cleanJSON } from '../providers/gateway';

const SYSTEM_PROMPT = `You are an app specification generation engine.
Given a DataSchema and AppIntent, generate a complete AppSpec.
Respond ONLY with valid JSON, no explanation, no markdown.

Output this exact structure:
{
  "pages": [
    {
      "name": "string",
      "route": "/string",
      "layout": "list | detail | dashboard | settings",
      "boundEntity": "EntityName",
      "components": ["table | form | chart | card"]
    }
  ],
  "apiEndpoints": [
    {
      "path": "/api/string",
      "method": "GET | POST | PUT | DELETE | PATCH",
      "handlerDescription": "string",
      "boundEntity": "EntityName",
      "authRequired": true,
      "rateLimitFlag": false
    }
  ],
  "authRules": [
    {
      "role": "string",
      "permissions": [
        {
          "entity": "EntityName",
          "read": true,
          "write": true,
          "delete": false
        }
      ]
    }
  ],
  "integrationHooks": [
    {
      "integrationId": "slack | stripe | whatsapp | gmail | webhook",
      "trigger": "string",
      "action": "string"
    }
  ],
  "workflowStubs": [
    {
      "name": "string",
      "trigger": {
        "entity": "EntityName",
        "event": "created | updated | deleted | status_changed",
        "condition": "optional string"
      },
      "integration": "integrationId",
      "action": "string",
      "payload": {
        "fieldName": "entityField"
      }
    }
  ]
}

Rules:
- Every page MUST have at least one corresponding API endpoint
- workflowStubs only for integrations in integrations_requested
- authRules must cover all entities
- routes must be valid URL paths`;

export async function generateAppSpec(schema: DataSchema, intent: AppIntent): Promise<{
  appSpec: AppSpec;
  tokensUsed: number;
  cost: number;
  provider: string;
}> {
  const routing = ROUTING_CONFIG.app_spec_generation;
  const userPrompt = `AppIntent: ${JSON.stringify(intent)}\nDataSchema: ${JSON.stringify(schema)}`;
  const response = await callChain(routing, SYSTEM_PROMPT, userPrompt);
  const clean = cleanJSON(response.content);

  try {
    const appSpec = JSON.parse(clean) as AppSpec;
    return { appSpec, tokensUsed: response.tokensUsed, cost: response.cost, provider: response.provider };
  } catch {
    const correctionPrompt = `Your previous response was not valid JSON.
DataSchema: ${JSON.stringify(schema)}
Return ONLY valid JSON with no markdown or explanation.`;
    const retry = await callChain(routing, SYSTEM_PROMPT, correctionPrompt);
    const appSpec = JSON.parse(cleanJSON(retry.content)) as AppSpec;
    return { appSpec, tokensUsed: response.tokensUsed + retry.tokensUsed, cost: response.cost + retry.cost, provider: retry.provider };
  }
}