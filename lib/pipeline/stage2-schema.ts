import { AppIntent, DataSchema } from '@/types';
import { ROUTING_CONFIG } from '../modelConfig';
import { callChain, cleanJSON } from '../providers/gateway';

const SYSTEM_PROMPT = `You are a database schema generation engine.
Given an AppIntent, generate a complete DataSchema.
Respond ONLY with valid JSON, no explanation, no markdown.

Output this exact structure:
{
  "entities": [
    {
      "name": "string",
      "tableName": "snake_case_string",
      "fields": [
        {
          "name": "string",
          "type": "string | number | boolean | date | uuid | text | enum",
          "nullable": false,
          "isRelation": false,
          "isPrimary": false,
          "isUnique": false
        }
      ],
      "relations": [
        {
          "type": "hasMany | belongsTo | hasOne",
          "target": "EntityName",
          "foreignKey": "string",
          "onDelete": "CASCADE | SET NULL | RESTRICT"
        }
      ]
    }
  ]
}

Rules:
- Every entity MUST have: id (uuid, primary), tenantId (uuid, not nullable), createdAt (date), updatedAt (date)
- Relations must be bidirectionally consistent
- tableName must be snake_case
- At least one entity per feature mentioned`;

export async function generateSchema(intent: AppIntent): Promise<{
  schema: DataSchema;
  tokensUsed: number;
  cost: number;
  provider: string;
}> {
  const routing = ROUTING_CONFIG.schema_generation;
  const response = await callChain(routing, SYSTEM_PROMPT, JSON.stringify(intent));
  console.log('Stage 2 provider used:', response.provider, '| model:', response.model);
  const clean = cleanJSON(response.content);

  try {
    const schema = JSON.parse(clean) as DataSchema;
    return { schema, tokensUsed: response.tokensUsed, cost: response.cost, provider: response.provider };
  } catch {
    const correctionPrompt = `Your previous response was not valid JSON.
AppIntent: ${JSON.stringify(intent)}
Return ONLY valid JSON with no markdown or explanation.`;
    const retry = await callChain(routing, SYSTEM_PROMPT, correctionPrompt);
    const schema = JSON.parse(cleanJSON(retry.content)) as DataSchema;
    return { schema, tokensUsed: response.tokensUsed + retry.tokensUsed, cost: response.cost + retry.cost, provider: retry.provider };
  }
}