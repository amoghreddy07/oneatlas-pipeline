# OneAtlas Pipeline

A multi-stage AI generation pipeline that converts natural language app descriptions into validated, machine-readable application specifications (AppSpec).

## Quick Start

```bash
git clone https://github.com/amoghreddy07/oneatlas-pipeline.git
cd oneatlas-pipeline
npm install
cp .env.example .env.local
# Add your API keys to .env.local
npm run dev
```

Open http://localhost:3000

## Environment Variables

Create a `.env.local` file with the following keys:

GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
DEEPSEEK_API_KEY=your_deepseek_key
OPENROUTER_API_KEY=your_openrouter_key
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
MISTRAL_API_KEY=your_mistral_key

Minimum required: GROQ_API_KEY + one of GEMINI_API_KEY or OPENROUTER_API_KEY.

## Pipeline Architecture
User Prompt
↓
Stage 1 — Intent Extraction (fast/cheap model)
↓ AppIntent
Stage 2 — Schema Generation (capable model)
↓ DataSchema
Stage 3 — App Spec Generation (capable model)
↓ AppSpec

Each stage runs through a **provider cascade chain** — if the primary provider fails or hits quota, it automatically falls through to the next:

DeepSeek → Groq (70b) → Gemini Flash → OpenRouter
### Supporting Systems

- **Validation layer** — Zod schema validation after every stage, cross-layer consistency checks
- **Repair engine** — 3 classified strategies: structural repair, field repair, consistency repair
- **SSE streaming** — real-time stage progress via Server-Sent Events
- **Cost tracking** — per-token cost logged per stage and accessible via job status endpoint

## Model Routing

All routing is config-driven in `lib/modelConfig.ts`. No model names are hardcoded in stage implementations.

| Stage | Primary | Fallbacks |
|-------|---------|-----------|
| Intent Extraction | Groq llama-3.1-8b-instant | Gemini Flash → Groq 70b → OpenRouter |
| Schema Generation | DeepSeek chat | Groq 70b → Gemini Flash → OpenRouter |
| App Spec Generation | DeepSeek chat | Groq 70b → Gemini Flash → OpenRouter |
| Repair | Groq llama-3.1-8b-instant | Gemini Flash → OpenRouter |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/generate | Start a generation job |
| GET | /api/generate/:jobId | Get job status + full output |
| GET | /api/generate/:jobId/stream | SSE stream of stage events |
| POST | /api/generate/:jobId/repair | Manually trigger repair on a stage |
| GET | /api/integrations | List integration registry |

## Integrations

### Fully Implemented
- **Slack** — send message to channel, DM, formatted block
- **WhatsApp** (via Twilio) — send template message, notification
- **Gmail** — send email, create calendar event
- **Stripe** — create customer, charge, manage subscription
- **Webhook** — POST payload with HMAC signature

### Stubbed (interface defined, HTTP call not implemented)
- Salesforce, HubSpot, Notion, Airtable, Twilio SMS, Google Sheets, Jira, GitHub, Zapier

## Deliberate Cuts

- No live OAuth flows — integration actions are stubs with correct metadata
- OpenRouter free model availability varies — used as last-resort fallback only
- DeepSeek requires funded account — falls back to Groq automatically
- Evaluation limited by free-tier daily quotas (Groq: 100k tokens/day, Gemini: daily limit)
- No persistent database — job store is in-memory

## Evaluation Results

See `evaluation/results.json` for full results across all 12 prompts.

**Summary:** 5/7 standard prompts confirmed successful. Pipeline handles edge cases gracefully with documented assumptions. Most common failure: provider quota exhaustion during bulk evaluation (not a pipeline bug — cascade chain correctly attempts all providers before failing).
