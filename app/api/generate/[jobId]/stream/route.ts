import { NextRequest } from 'next/server';
import { getJob, updateJob } from '@/lib/jobStore';
import { runPipeline } from '@/lib/pipeline/runner';
import { StageResult } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return new Response('Job not found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: any) {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      }

      // Replay existing stages
      job.stages.forEach(stage => {
        sendEvent('stage_complete', {
          stage: stage.stage,
          status: stage.status,
          latency: stage.latency,
          cost: stage.cost,
          timestamp: Date.now(),
        });
      });

      // If job already complete, send final event
      if (job.status === 'complete') {
        sendEvent('generation_complete', {
          jobId: job.id,
          status: 'complete',
          totalCost: job.totalCost,
          totalLatency: job.totalLatency,
          timestamp: Date.now(),
        });
        controller.close();
        return;
      }

      // Run pipeline with live updates
      try {
        await runPipeline(job.prompt, (stageResult: StageResult) => {
          if (stageResult.status === 'running') {
            sendEvent('stage_start', {
              stage: stageResult.stage,
              timestamp: Date.now(),
            });
          } else {
            sendEvent('stage_complete', {
              stage: stageResult.stage,
              status: stageResult.status,
              latency: stageResult.latency,
              cost: stageResult.cost,
              repairLog: stageResult.repairLog,
              timestamp: Date.now(),
            });
          }
        });

        const completedJob = getJob(job.id);
        sendEvent('generation_complete', {
          jobId: job.id,
          status: completedJob?.status,
          totalCost: completedJob?.totalCost,
          totalLatency: completedJob?.totalLatency,
          timestamp: Date.now(),
        });

      } catch (error: any) {
        sendEvent('stage_failed', {
          error: error.message,
          timestamp: Date.now(),
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}