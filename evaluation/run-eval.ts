import * as fs from 'fs';

const BASE_URL = 'http://localhost:3000';

const PROMPTS = [
  // Standard
  { id: 1, type: 'standard', prompt: 'Build a CRM for a real estate agency. Agents manage leads, properties, and deals. Admin sees analytics. WhatsApp notifications when a deal closes.' },
  { id: 2, type: 'standard', prompt: 'Task manager for an engineering team. Tasks have due dates, assignees, priorities, and status. Team lead gets a Slack message when a task is overdue.' },
  { id: 3, type: 'standard', prompt: 'Inventory system for a warehouse. Products, stock movements, suppliers. Low stock triggers an email alert.' },
  { id: 4, type: 'standard', prompt: 'HR tool for a 50-person company. Track employees, leave requests, and performance reviews. Notify manager on Slack when leave is approved.' },
  { id: 5, type: 'standard', prompt: 'E-commerce backend. Products, orders, customers, payments via Stripe. Order confirmation sent via Gmail.' },
  { id: 6, type: 'standard', prompt: 'Event management platform. Organizers create events, attendees register, QR check-in at the door. Confirmation via WhatsApp.' },
  { id: 7, type: 'standard', prompt: 'Project tracker. Projects, milestones, tasks. Sync tasks to Jira. Update a Google Sheet with weekly progress.' },
  // Edge cases
  { id: 8, type: 'edge', prompt: 'An app.' },
  { id: 9, type: 'edge', prompt: 'Build something like Notion for doctors.' },
  { id: 10, type: 'edge', prompt: 'A platform with login, payments, roles, real-time chat, file uploads, native mobile, analytics, and a marketplace.' },
  { id: 11, type: 'edge', prompt: 'A CRM but also a project manager but also an invoicing tool.' },
  { id: 12, type: 'edge', prompt: 'Task manager, but make it smart.' },
];

async function runPrompt(id: number, type: string, prompt: string) {
  console.log(`\nRunning prompt ${id} (${type}): ${prompt.slice(0, 50)}...`);
  const start = Date.now();

  try {
    // Start job
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const { jobId } = await res.json();

    // Poll until complete
    let job: any = null;
    let attempts = 0;
    while (attempts < 60) {
      await new Promise(r => setTimeout(r, 2000));
      const jobRes = await fetch(`${BASE_URL}/api/generate/${jobId}`);
      job = await jobRes.json();
      if (job.status === 'complete' || job.status === 'failed') break;
      attempts++;
    }

    const latency = Date.now() - start;
    const failedStage = job.stages?.find((s: any) => s.status === 'failed')?.stage || null;
    const repairsUsed = job.stages?.flatMap((s: any) => s.repairLog || []) || [];
    const integrationsDetected = job.intent?.integrations_requested || [];

    console.log(`  Status: ${job.status} | Latency: ${latency}ms | Cost: $${job.totalCost?.toFixed(6)}`);

    return {
      id,
      type,
      prompt: prompt.slice(0, 80),
      success: job.status === 'complete',
      status: job.status,
      failedStage,
      repairsUsed: repairsUsed.length,
      repairStrategies: repairsUsed.map((r: any) => r.strategy),
      retryCount: repairsUsed.length,
      latencyMs: latency,
      estimatedCost: job.totalCost || 0,
      integrationsDetected,
      stages: job.stages?.map((s: any) => ({
        stage: s.stage,
        status: s.status,
        latency: s.latency,
      })),
    };
  } catch (error: any) {
    console.log(`  FAILED: ${error.message}`);
    return {
      id,
      type,
      prompt: prompt.slice(0, 80),
      success: false,
      status: 'error',
      failedStage: 'unknown',
      repairsUsed: 0,
      repairStrategies: [],
      retryCount: 0,
      latencyMs: Date.now() - start,
      estimatedCost: 0,
      integrationsDetected: [],
      error: error.message,
    };
  }
}

async function main() {
  console.log('Starting evaluation suite...');
  const results = [];

  for (const { id, type, prompt } of PROMPTS) {
    const result = await runPrompt(id, type, prompt);
    results.push(result);
    // Wait 2 seconds between prompts to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  // Calculate summary stats
  const total = results.length;
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgLatency = results.reduce((a, b) => a + b.latencyMs, 0) / total;
  const totalCost = results.reduce((a, b) => a + b.estimatedCost, 0);
  const failureTypes = results.filter(r => !r.success).map(r => r.failedStage);

  const summary = {
    successRate: `${successful}/${total} (${((successful / total) * 100).toFixed(0)}%)`,
    totalCost: `$${totalCost.toFixed(6)}`,
    avgLatencyMs: Math.round(avgLatency),
    failedPrompts: failed,
    commonFailureStage: failureTypes[0] || 'none',
  };

  const output = {
    runAt: new Date().toISOString(),
    summary,
    results,
  };

  fs.writeFileSync('evaluation/results.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Evaluation complete!');
  console.log(`Success rate: ${summary.successRate}`);
  console.log(`Total cost: ${summary.totalCost}`);
  console.log(`Avg latency: ${summary.avgLatencyMs}ms`);
  console.log('Results saved to evaluation/results.json');
}

main().catch(console.error);