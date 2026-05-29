import { RepairLog } from '@/types';
import { ROUTING_CONFIG } from '../modelConfig';
import { callChain, cleanJSON } from '../providers/gateway';
import { ValidationError } from '../validation/validator';

export interface RepairResult {
  success: boolean;
  data: any;
  logs: RepairLog[];
}

// Strategy 1: Structural repair - fix malformed JSON
function structuralRepair(raw: string): { success: boolean; data: any } {
  try {
    const clean = cleanJSON(raw);
    const data = JSON.parse(clean);
    return { success: true, data };
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]);
        return { success: true, data };
      } catch {
        return { success: false, data: null };
      }
    }
    return { success: false, data: null };
  }
}

// Strategy 2: Field repair - fix missing fields with defaults
function fieldRepair(data: any, errors: ValidationError[]): { success: boolean; data: any } {
  const fixed = { ...data };
  let repaired = false;

  errors.forEach(error => {
    if (error.type === 'missing_field') {
      const field = error.field;
      if (field === 'appType') { fixed.appType = 'custom'; repaired = true; }
      if (field === 'features') { fixed.features = []; repaired = true; }
      if (field === 'entities') { fixed.entities = []; repaired = true; }
      if (field === 'integrations_requested') { fixed.integrations_requested = []; repaired = true; }
      if (field === 'assumptions') { fixed.assumptions = []; repaired = true; }
      if (field === 'pages') { fixed.pages = []; repaired = true; }
      if (field === 'apiEndpoints') { fixed.apiEndpoints = []; repaired = true; }
      if (field === 'authRules') { fixed.authRules = []; repaired = true; }
      if (field === 'integrationHooks') { fixed.integrationHooks = []; repaired = true; }
      if (field === 'workflowStubs') { fixed.workflowStubs = []; repaired = true; }

      if (field.includes('tenantId') && fixed.entities) {
        fixed.entities = fixed.entities.map((entity: any) => {
          const hasTenantId = entity.fields?.some((f: any) => f.name === 'tenantId');
          if (!hasTenantId) {
            entity.fields = [
              ...(entity.fields || []),
              { name: 'tenantId', type: 'uuid', nullable: false, isRelation: false, isPrimary: false, isUnique: false }
            ];
          }
          return entity;
        });
        repaired = true;
      }
    }
  });

  return { success: repaired, data: fixed };
}

// Strategy 3: Consistency repair - fix broken references
function consistencyRepair(data: any, errors: ValidationError[]): { success: boolean; data: any } {
  const fixed = { ...data };
  let repaired = false;

  errors.forEach(error => {
    if (error.type === 'inconsistency') {
      if (error.field.startsWith('pages[')) {
        const pageIndex = parseInt(error.field.match(/\d+/)?.[0] || '0');
        const page = fixed.pages?.[pageIndex];
        if (page) {
          fixed.apiEndpoints = [
            ...(fixed.apiEndpoints || []),
            {
              path: `/api/${page.boundEntity?.toLowerCase() || 'resource'}`,
              method: 'GET',
              handlerDescription: `Get ${page.name} data`,
              boundEntity: page.boundEntity,
              authRequired: true,
              rateLimitFlag: false,
            }
          ];
          repaired = true;
        }
      }
    }

    if (error.type === 'broken_reference' && error.field.startsWith('workflowStubs')) {
      const entityNames = fixed.entities?.map((e: any) => e.name) || [];
      fixed.workflowStubs = fixed.workflowStubs?.filter((stub: any) =>
        entityNames.includes(stub.trigger?.entity)
      );
      repaired = true;
    }
  });

  return { success: repaired, data: fixed };
}

// Main repair engine
export async function repairOutput(
  raw: string,
  data: any,
  errors: ValidationError[],
  stage: string
): Promise<RepairResult> {
  const logs: RepairLog[] = [];

  // Strategy 1: Structural repair
  if (!data) {
    const result = structuralRepair(raw);
    logs.push({
      strategy: 'structural',
      errorInput: raw.slice(0, 200),
      outcome: result.success ? 'repaired' : 'escalated',
    });
    if (result.success) return { success: true, data: result.data, logs };
  }

  // Strategy 2: Field repair
  if (data && errors.some(e => e.type === 'missing_field' || e.type === 'wrong_type')) {
    const result = fieldRepair(data, errors);
    logs.push({
      strategy: 'field',
      errorInput: JSON.stringify(errors.slice(0, 3)),
      outcome: result.success ? 'repaired' : 'escalated',
    });
    if (result.success) return { success: true, data: result.data, logs };
  }

  // Strategy 3: Consistency repair
  if (data && errors.some(e => e.type === 'inconsistency' || e.type === 'broken_reference')) {
    const result = consistencyRepair(data, errors);
    logs.push({
      strategy: 'consistency',
      errorInput: JSON.stringify(errors.slice(0, 3)),
      outcome: result.success ? 'repaired' : 'escalated',
    });
    if (result.success) return { success: true, data: result.data, logs };
  }

  // All strategies failed - escalate with AI re-prompt
  try {
    const routing = ROUTING_CONFIG.repair;
    const repairPrompt = `Fix this JSON output for stage ${stage}.
Errors: ${JSON.stringify(errors)}
Current output: ${JSON.stringify(data)}
Return ONLY valid fixed JSON.`;

    const response = await callChain(routing, 'You are a JSON repair engine. Fix the output and return only valid JSON.', repairPrompt);
    const clean = cleanJSON(response.content);
    const fixed = JSON.parse(clean);

    logs.push({
      strategy: 'structural',
      errorInput: JSON.stringify(errors),
      outcome: 'repaired',
    });

    return { success: true, data: fixed, logs };
  } catch {
    logs.push({
      strategy: 'structural',
      errorInput: JSON.stringify(errors),
      outcome: 'failed',
    });
    return { success: false, data, logs };
  }
}