export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'groq' | 'gemini' | 'deepseek' | 'openrouter' | 'mistral';
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface StageRouting {
  chain: ModelConfig[];
}

export const COST_TABLE: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-sonnet-4-5': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5': { input: 0.00025, output: 0.00125 },
  'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
  'llama-3.1-8b-instant': { input: 0.00005, output: 0.00008 },
  'deepseek-chat': { input: 0.00014, output: 0.00028 },
  'gemini-2.0-flash': { input: 0.000075, output: 0.0003 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'mistral-7b-instruct': { input: 0.00025, output: 0.00025 },
  'mistralai/mistral-small-3.1-24b-instruct:free': { input: 0, output: 0 },
};

export const ROUTING_CONFIG: Record<string, StageRouting> = {
  intent_extraction: {
    chain: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', maxTokens: 800, temperature: 0.1 },
      { provider: 'gemini', model: 'gemini-2.0-flash', maxTokens: 800, temperature: 0.1 },
      { provider: 'groq', model: 'llama-3.3-70b-versatile', maxTokens: 800, temperature: 0.1 },
      { provider: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free', maxTokens: 800, temperature: 0.1 },
    ],
  },
  schema_generation: {
    chain: [
      { provider: 'deepseek', model: 'deepseek-chat', maxTokens: 2500, temperature: 0.1 },
      { provider: 'groq', model: 'llama-3.3-70b-versatile', maxTokens: 2500, temperature: 0.1 },
      { provider: 'gemini', model: 'gemini-2.0-flash', maxTokens: 2500, temperature: 0.1 },
      { provider: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free', maxTokens: 2500, temperature: 0.1 },
    ],
  },
  app_spec_generation: {
    chain: [
      { provider: 'deepseek', model: 'deepseek-chat', maxTokens: 3500, temperature: 0.1 },
      { provider: 'groq', model: 'llama-3.3-70b-versatile', maxTokens: 3500, temperature: 0.1 },
      { provider: 'gemini', model: 'gemini-2.0-flash', maxTokens: 3500, temperature: 0.1 },
      { provider: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free', maxTokens: 3500, temperature: 0.1 },
    ],
  },
  repair: {
    chain: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', maxTokens: 1000, temperature: 0.1 },
      { provider: 'gemini', model: 'gemini-2.0-flash', maxTokens: 1000, temperature: 0.1 },
      { provider: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free', maxTokens: 1000, temperature: 0.1 },
    ],
  },
};