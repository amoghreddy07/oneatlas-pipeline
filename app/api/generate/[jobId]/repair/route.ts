import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '@/lib/jobStore';
import { repairOutput } from '@/lib/repair/repairEngine';
import { validateIntent, validateSchema, validateAppSpec } from '@/lib/validation/validator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { stage, errorHint } = await request.json();

  // Find the stage output
  const stageResult = job.stages.find(s => s.stage === stage);
  if (!stageResult) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
  }

  // Get validation errors
  let errors: any[] = [];
  if (stage === 'intent_extraction') {
    const v = validateIntent(stageResult.output);
    errors = v.errors;
  } else if (stage === 'schema_generation') {
    const v = validateSchema(stageResult.output);
    errors = v.errors;
  } else if (stage === 'app_spec_generation' && job.dataSchema) {
    const v = validateAppSpec(stageResult.output, job.dataSchema);
    errors = v.errors;
  }

  if (errorHint) {
    errors.push({ field: 'manual', message: errorHint, type: 'inconsistency' });
  }

  const repairResult = await repairOutput(
    JSON.stringify(stageResult.output),
    stageResult.output,
    errors,
    stage
  );

  return NextResponse.json({
    success: repairResult.success,
    logs: repairResult.logs,
    repairedOutput: repairResult.data,
  });
}