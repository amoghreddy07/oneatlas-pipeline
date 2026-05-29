import { Job } from '@/types';

// In-memory job store
const jobs = new Map<string, Job>();

export function createJob(id: string, prompt: string): Job {
  const job: Job = {
    id,
    prompt,
    status: 'pending',
    stages: [],
    totalCost: 0,
    totalLatency: 0,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | null {
  return jobs.get(id) || null;
}

export function updateJob(id: string, updates: Partial<Job>): Job | null {
  const job = jobs.get(id);
  if (!job) return null;
  const updated = { ...job, ...updates };
  jobs.set(id, updated);
  return updated;
}

export function getAllJobs(): Job[] {
  return Array.from(jobs.values());
}