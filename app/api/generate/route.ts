import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createJob, updateJob, getJob } from '@/lib/jobStore';
import { runPipeline } from '@/lib/pipeline/runner';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const jobId = uuidv4();
    createJob(jobId, prompt);

    // Run pipeline in background
    runPipeline(prompt, undefined).then(job => {
      updateJob(jobId, job);
    }).catch(err => {
      updateJob(jobId, { status: 'failed' });
    });

    return NextResponse.json({ jobId });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}