'use client';

import { useState, useRef } from 'react';
import { Job } from '@/types';

const STAGES = ['intent_extraction', 'schema_generation', 'app_spec_generation'];

const STAGE_LABELS: Record<string, string> = {
  intent_extraction: 'Intent Extraction',
  schema_generation: 'Schema Generation',
  app_spec_generation: 'App Spec Generation',
};

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [stages, setStages] = useState<Record<string, string>>({});
  const [latencies, setLatencies] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'entities' | 'pages' | 'endpoints' | 'integrations' | 'workflows' | 'errors'>('entities');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setJob(null);
    setStages({});
    setLatencies({});
    setErrors([]);

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const { jobId: id } = await res.json();
    setJobId(id);

    if (eventSourceRef.current) eventSourceRef.current.close();
    const es = new EventSource(`/api/generate/${id}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('stage_start', (e) => {
      const data = JSON.parse(e.data);
      setStages(prev => ({ ...prev, [data.stage]: 'running' }));
    });

    es.addEventListener('stage_complete', (e) => {
      const data = JSON.parse(e.data);
      setStages(prev => ({ ...prev, [data.stage]: 'complete' }));
      if (data.latency) setLatencies(prev => ({ ...prev, [data.stage]: data.latency }));
    });

    es.addEventListener('stage_failed', (e) => {
      const data = JSON.parse(e.data);
      setStages(prev => ({ ...prev, [data.stage]: 'failed' }));
      setErrors(prev => [...prev, data.error]);
    });

    es.addEventListener('generation_complete', async () => {
      es.close();
      // Force all completed stages to show complete
      setStages({
        intent_extraction: 'complete',
        schema_generation: 'complete',
        app_spec_generation: 'complete',
      });
      // Small delay to ensure job store has updated
      await new Promise(r => setTimeout(r, 800));
      const jobRes = await fetch(`/api/generate/${id}`);
      const jobData = await jobRes.json();
      setJob(jobData);
      setLoading(false);
    });

    es.onerror = async () => {
      es.close();
      // Even on error, try to fetch final job state
      await new Promise(r => setTimeout(r, 500));
      const jobRes = await fetch(`/api/generate/${id}`);
      const jobData = await jobRes.json();
      if (jobData.appSpec) {
        setStages({
          intent_extraction: 'complete',
          schema_generation: 'complete',
          app_spec_generation: 'complete',
        });
        setJob(jobData);
      }
      setLoading(false);
    };
  }

  const isComplete = job?.appSpec != null;

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="max-w-7xl mx-auto p-6">

        {/* Header */}
        <div className="border-b border-gray-800 pb-4 mb-6">
          <h1 className="text-xl font-bold tracking-widest uppercase">OneAtlas Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">Natural language → validated AppSpec</p>
        </div>

        {/* Input */}
        <div className="mb-6">
          <textarea
            className="w-full bg-gray-950 border border-gray-800 rounded p-4 text-sm text-white placeholder-gray-600 outline-none focus:border-gray-600 resize-none"
            rows={3}
            placeholder="Describe your app (e.g. Build a CRM for real estate agents with WhatsApp notifications when a deal closes)"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="mt-2 px-6 py-2 bg-white text-black text-sm font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Stage Progress */}
        {(loading || job) && (
          <div className="mb-6 border border-gray-800 rounded p-4">
            <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">Pipeline Progress</div>
            <div className="grid grid-cols-3 gap-4">
              {STAGES.map(stage => {
                const status = stages[stage];
                return (
                  <div key={stage} className="border border-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1">{STAGE_LABELS[stage]}</div>
                    <div className={`text-sm font-bold ${
                      status === 'complete' ? 'text-green-400' :
                      status === 'running' ? 'text-yellow-400' :
                      status === 'failed' ? 'text-red-400' :
                      'text-gray-600'
                    }`}>
                      {status === 'running' ? '⟳ Running' :
                       status === 'complete' ? '✓ Complete' :
                       status === 'failed' ? '✕ Failed' :
                       '○ Pending'}
                    </div>
                    {latencies[stage] && (
                      <div className="text-xs text-gray-600 mt-1">{latencies[stage]}ms</div>
                    )}
                  </div>
                );
              })}
            </div>
            {(job || isComplete) && (
              <div className="mt-3 pt-3 border-t border-gray-800 flex gap-6 text-xs text-gray-500">
                <span>Total Cost: ${job?.totalCost?.toFixed(6) ?? '0.000000'}</span>
                <span>Total Latency: {job?.totalLatency ?? 0}ms</span>
                <span>Status: <span className={isComplete ? 'text-green-400' : 'text-red-400'}>
                  {isComplete ? 'complete' : job?.status ?? 'pending'}
                </span></span>
              </div>
            )}
          </div>
        )}

        {/* Output Panel */}
        {job?.appSpec && (
          <div className="border border-gray-800 rounded">
            <div className="flex border-b border-gray-800">
              {(['entities', 'pages', 'endpoints', 'integrations', 'workflows', 'errors'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-xs uppercase tracking-widest ${
                    activeTab === tab ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-400'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* Entities Tab */}
              {activeTab === 'entities' && job.dataSchema && (
                <div className="space-y-4">
                  {job.dataSchema.entities.map((entity, i) => (
                    <div key={i} className="border border-gray-800 rounded p-3">
                      <div className="font-bold text-sm mb-2">{entity.name} <span className="text-gray-500 font-normal">({entity.tableName})</span></div>
                      <div className="grid grid-cols-4 gap-1 text-xs">
                        {entity.fields.map((field, j) => (
                          <div key={j} className="bg-gray-900 px-2 py-1 rounded">
                            <span className="text-white">{field.name}</span>
                            <span className="text-gray-500 ml-1">{field.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pages Tab */}
              {activeTab === 'pages' && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-2">Page</th>
                      <th className="text-left py-2">Route</th>
                      <th className="text-left py-2">Layout</th>
                      <th className="text-left py-2">Entity</th>
                      <th className="text-left py-2">Components</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.appSpec.pages.map((page, i) => (
                      <tr key={i} className="border-b border-gray-900">
                        <td className="py-2">{page.name}</td>
                        <td className="py-2 text-gray-400">{page.route}</td>
                        <td className="py-2 text-gray-400">{page.layout}</td>
                        <td className="py-2 text-gray-400">{page.boundEntity}</td>
                        <td className="py-2 text-gray-400">{page.components.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Endpoints Tab */}
              {activeTab === 'endpoints' && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-2">Method</th>
                      <th className="text-left py-2">Path</th>
                      <th className="text-left py-2">Entity</th>
                      <th className="text-left py-2">Auth</th>
                      <th className="text-left py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.appSpec.apiEndpoints.map((ep, i) => (
                      <tr key={i} className="border-b border-gray-900">
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            ep.method === 'GET' ? 'bg-blue-900 text-blue-300' :
                            ep.method === 'POST' ? 'bg-green-900 text-green-300' :
                            ep.method === 'PUT' ? 'bg-yellow-900 text-yellow-300' :
                            'bg-red-900 text-red-300'
                          }`}>{ep.method}</span>
                        </td>
                        <td className="py-2 text-gray-400">{ep.path}</td>
                        <td className="py-2 text-gray-400">{ep.boundEntity}</td>
                        <td className="py-2">{ep.authRequired ? '🔒' : '🔓'}</td>
                        <td className="py-2 text-gray-500">{ep.handlerDescription}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Integrations Tab */}
              {activeTab === 'integrations' && (
                <div className="space-y-2">
                  {job.appSpec.integrationHooks.length === 0 ? (
                    <div className="text-gray-500 text-sm">No integrations in this app</div>
                  ) : (
                    job.appSpec.integrationHooks.map((hook, i) => (
                      <div key={i} className="border border-gray-800 rounded p-3 text-xs">
                        <span className="text-white font-bold">{hook.integrationId}</span>
                        <span className="text-gray-500 mx-2">→</span>
                        <span className="text-gray-400">{hook.action}</span>
                        <span className="text-gray-600 ml-2">on {hook.trigger}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Workflows Tab */}
              {activeTab === 'workflows' && (
                <div className="space-y-3">
                  {job.appSpec.workflowStubs.length === 0 ? (
                    <div className="text-gray-500 text-sm">No workflow stubs</div>
                  ) : (
                    job.appSpec.workflowStubs.map((stub, i) => (
                      <div key={i} className="border border-gray-800 rounded p-3 text-xs">
                        <div className="font-bold text-white mb-1">{stub.name}</div>
                        <div className="text-gray-400">
                          Trigger: {stub.trigger.entity} → {stub.trigger.event}
                          {stub.trigger.condition && <span className="text-gray-600"> ({stub.trigger.condition})</span>}
                        </div>
                        <div className="text-gray-400">Integration: {stub.integration} → {stub.action}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Errors Tab */}
              {activeTab === 'errors' && (
                <div className="space-y-2">
                  {job.stages.map((stage, i) => (
                    stage.repairLog && stage.repairLog.length > 0 && (
                      <div key={i} className="border border-gray-800 rounded p-3">
                        <div className="text-xs font-bold text-gray-400 mb-2">{STAGE_LABELS[stage.stage]}</div>
                        {stage.repairLog.map((log, j) => (
                          <div key={j} className="text-xs mb-1">
                            <span className={`px-1 rounded mr-2 ${
                              log.outcome === 'repaired' ? 'bg-green-900 text-green-300' :
                              log.outcome === 'failed' ? 'bg-red-900 text-red-300' :
                              'bg-yellow-900 text-yellow-300'
                            }`}>{log.outcome}</span>
                            <span className="text-gray-500">{log.strategy} repair</span>
                          </div>
                        ))}
                      </div>
                    )
                  ))}
                  {errors.map((err, i) => (
                    <div key={i} className="text-red-400 text-xs border border-red-900 rounded p-2">{err}</div>
                  ))}
                  {job.stages.every(s => !s.repairLog?.length) && errors.length === 0 && (
                    <div className="text-gray-500 text-sm">No errors or repairs needed ✓</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}