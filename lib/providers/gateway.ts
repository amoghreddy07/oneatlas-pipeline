import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ModelConfig, StageRouting, COST_TABLE } from '../modelConfig';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface GatewayResponse {
  content: string;
  tokensUsed: number;
  cost: number;
  provider: string;
  model: string;
}

export async function callChain(
  routing: StageRouting,
  systemPrompt: string,
  userPrompt: string
): Promise<GatewayResponse> {
  const errors: string[] = [];

  for (const config of routing.chain) {
    try {
      console.log(`Trying provider: ${config.provider} / model: ${config.model}`);
      const result = await callModel(config, systemPrompt, userPrompt);
      if (!result.content || result.content.trim() === '') {
        throw new Error('Empty response');
      }
      console.log(`Success with: ${config.provider} / ${config.model}`);
      return result;
    } catch (err: any) {
      const msg = `${config.provider}/${config.model} failed: ${err.message}`;
      console.warn(msg);
      errors.push(msg);
    }
  }

  throw new Error(`All providers failed:\n${errors.join('\n')}`);
}

export async function callModel(
  config: ModelConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<GatewayResponse> {
  if (config.provider === 'groq') return await callGroq(config, systemPrompt, userPrompt);
  if (config.provider === 'gemini') return await callGemini(config, systemPrompt, userPrompt);
  if (config.provider === 'deepseek') return await callDeepSeek(config, systemPrompt, userPrompt);
  if (config.provider === 'openrouter') return await callOpenRouter(config, systemPrompt, userPrompt);
  throw new Error(`Unknown provider: ${config.provider}`);
}

async function callGroq(config: ModelConfig, systemPrompt: string, userPrompt: string): Promise<GatewayResponse> {
  const response = await groq.chat.completions.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  const content = response.choices[0].message.content || '';
  const tokensUsed = (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);
  const costTable = COST_TABLE[config.model] || { input: 0, output: 0 };
  const cost = ((response.usage?.prompt_tokens || 0) / 1000) * costTable.input +
               ((response.usage?.completion_tokens || 0) / 1000) * costTable.output;
  return { content, tokensUsed, cost, provider: 'groq', model: config.model };
}

async function callGemini(config: ModelConfig, systemPrompt: string, userPrompt: string): Promise<GatewayResponse> {
  const model = gemini.getGenerativeModel({ model: config.model, systemInstruction: systemPrompt });
  const result = await model.generateContent(userPrompt);
  const content = result.response.text();
  const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;
  const costTable = COST_TABLE[config.model] || { input: 0, output: 0 };
  const cost = (tokensUsed / 1000) * costTable.input;
  return { content, tokensUsed, cost, provider: 'gemini', model: config.model };
}

async function callDeepSeek(config: ModelConfig, systemPrompt: string, userPrompt: string): Promise<GatewayResponse> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(`DeepSeek: ${data.error.message}`);
  const content = data.choices?.[0]?.message?.content || '';
  if (!content) throw new Error('DeepSeek returned empty content');
  const tokensUsed = data.usage?.total_tokens || 0;
  const cost = (tokensUsed / 1000) * 0.00014;
  return { content, tokensUsed, cost, provider: 'deepseek', model: config.model };
}

async function callOpenRouter(config: ModelConfig, systemPrompt: string, userPrompt: string): Promise<GatewayResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://oneatlas.dev',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(`OpenRouter: ${data.error.message}`);
  const content = data.choices?.[0]?.message?.content || '';
  if (!content) throw new Error('OpenRouter returned empty content');
  const tokensUsed = data.usage?.total_tokens || 0;
  const costTable = COST_TABLE[config.model] || { input: 0, output: 0 };
  const cost = (tokensUsed / 1000) * costTable.input;
  return { content, tokensUsed, cost, provider: 'openrouter', model: config.model };
}

export function cleanJSON(raw: string): string {
  let clean = raw.trim();
  if (clean.startsWith('```')) {
    clean = clean.split('```')[1];
    if (clean.startsWith('json')) clean = clean.slice(4);
  }
  clean = clean.replace(/```/g, '').trim();
  return clean;
}