import { v4 as uuidv4 } from 'uuid';
import { Job, StageResult } from '@/types';
import { createJob, updateJob, getJob } from '../jobStore';
import { extractIntent } from './stage1-intent';
import { generateSchema } from './stage2-schema';
import { generateAppSpec } from './stage3-appspec';
import { validateIntent, validateSchema, validateAppSpec } from '../validation/validator';
import { repairOutput } from '../repair/repairEngine';

export async function runPipeline(
  prompt: string,
  onStageUpdate?: (stage: StageResult) => void
): Promise<Job> {
  const jobId = uuidv4();
  const job = createJob(jobId, prompt);
  updateJob(jobId, { status: 'running' });

  let totalCost = 0;
  let totalLatency = 0;

  try {
    // ─── STAGE 1: Intent Extraction ───────────────────────
    const stage1Start = Date.now();
    const stageResult1: StageResult = {
      stage: 'intent_extraction',
      status: 'running',
    };

    onStageUpdate?.(stageResult1);

    const { intent, tokensUsed: t1, cost: c1, provider: p1 } = await extractIntent(prompt);

    // Validate Stage 1
    let validation1 = validateIntent(intent);
    let repairLogs1: any[] = [];

    if (!validation1.valid) {
      const repair = await repairOutput(JSON.stringify(intent), intent, validation1.errors, 'intent_extraction');
      repairLogs1 = repair.logs;
      if (repair.success) {
        Object.assign(intent, repair.data);
        validation1 = validateIntent(intent);
      }
    }

    const latency1 = Date.now() - stage1Start;
    totalCost += c1;
    totalLatency += latency1;

    const completedStage1: StageResult = {
      stage: 'intent_extraction',
      status: validation1.valid ? 'complete' : 'failed',
      output: intent,
      latency: latency1,
      tokens: t1,
      cost: c1,
      repairLog: repairLogs1,
    };

    onStageUpdate?.(completedStage1);
    updateJob(jobId, {
      intent,
      stages: [...(getJob(jobId)?.stages || []), completedStage1],
    });

    if (!validation1.valid) throw new Error('Stage 1 failed validation');

    // ─── STAGE 2: Schema Generation ───────────────────────
    const stage2Start = Date.now();
    const stageResult2: StageResult = {
      stage: 'schema_generation',
      status: 'running',
    };

    onStageUpdate?.(stageResult2);

    const { schema, tokensUsed: t2, cost: c2 } = await generateSchema(intent);

    // Validate Stage 2
    let validation2 = validateSchema(schema);
    let repairLogs2: any[] = [];

    if (!validation2.valid) {
      const repair = await repairOutput(JSON.stringify(schema), schema, validation2.errors, 'schema_generation');
      repairLogs2 = repair.logs;
      if (repair.success) {
        Object.assign(schema, repair.data);
        validation2 = validateSchema(schema);
      }
    }

    const latency2 = Date.now() - stage2Start;
    totalCost += c2;
    totalLatency += latency2;

    const completedStage2: StageResult = {
      stage: 'schema_generation',
      status: validation2.valid ? 'complete' : 'failed',
      output: schema,
      latency: latency2,
      tokens: t2,
      cost: c2,
      repairLog: repairLogs2,
    };

    onStageUpdate?.(completedStage2);
    updateJob(jobId, {
      dataSchema: schema,
      stages: [...(getJob(jobId)?.stages || []), completedStage2],
    });

    if (!validation2.valid) throw new Error('Stage 2 failed validation');

    // ─── STAGE 3: App Spec Generation ─────────────────────
    const stage3Start = Date.now();
    const stageResult3: StageResult = {
      stage: 'app_spec_generation',
      status: 'running',
    };

    onStageUpdate?.(stageResult3);

    const { appSpec, tokensUsed: t3, cost: c3 } = await generateAppSpec(schema, intent);

    // Validate Stage 3
    let validation3 = validateAppSpec(appSpec, schema);
    let repairLogs3: any[] = [];

    if (!validation3.valid) {
      const repair = await repairOutput(JSON.stringify(appSpec), appSpec, validation3.errors, 'app_spec_generation');
      repairLogs3 = repair.logs;
      if (repair.success) {
        Object.assign(appSpec, repair.data);
        validation3 = validateAppSpec(appSpec, schema);
      }
    }

    const latency3 = Date.now() - stage3Start;
    totalCost += c3;
    totalLatency += latency3;

    const completedStage3: StageResult = {
      stage: 'app_spec_generation',
      status: validation3.valid ? 'complete' : 'failed',
      output: appSpec,
      latency: latency3,
      tokens: t3,
      cost: c3,
      repairLog: repairLogs3,
    };

    onStageUpdate?.(completedStage3);
    updateJob(jobId, {
      appSpec,
      stages: [...(getJob(jobId)?.stages || []), completedStage3],
      status: 'complete',
      totalCost,
      totalLatency,
    });

    return getJob(jobId)!;

  } catch (error: any) {
    updateJob(jobId, {
      status: 'failed',
      totalCost,
      totalLatency,
    });
    return getJob(jobId)!;
  }
}