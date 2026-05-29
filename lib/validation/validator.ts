import { AppIntent, DataSchema, AppSpec, RepairLog } from '@/types';

export interface ValidationError {
  field: string;
  message: string;
  type: 'missing_field' | 'wrong_type' | 'inconsistency' | 'broken_reference';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Validate Stage 1 output
export function validateIntent(intent: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!intent.appName) errors.push({ field: 'appName', message: 'appName is required', type: 'missing_field' });
  if (!intent.appType) errors.push({ field: 'appType', message: 'appType is required', type: 'missing_field' });
  if (!Array.isArray(intent.features)) errors.push({ field: 'features', message: 'features must be an array', type: 'wrong_type' });
  if (!Array.isArray(intent.entities)) errors.push({ field: 'entities', message: 'entities must be an array', type: 'wrong_type' });
  if (!Array.isArray(intent.integrations_requested)) errors.push({ field: 'integrations_requested', message: 'integrations_requested must be an array', type: 'wrong_type' });
  if (!Array.isArray(intent.assumptions)) errors.push({ field: 'assumptions', message: 'assumptions must be an array', type: 'wrong_type' });

  const validAppTypes = ['crm', 'project_management', 'ecommerce', 'hr_tool', 'inventory', 'content_platform', 'analytics', 'custom'];
  if (intent.appType && !validAppTypes.includes(intent.appType)) {
    errors.push({ field: 'appType', message: `appType must be one of: ${validAppTypes.join(', ')}`, type: 'wrong_type' });
  }

  return { valid: errors.length === 0, errors };
}

// Validate Stage 2 output
export function validateSchema(schema: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!schema.entities || !Array.isArray(schema.entities)) {
    errors.push({ field: 'entities', message: 'entities array is required', type: 'missing_field' });
    return { valid: false, errors };
  }

  const entityNames = schema.entities.map((e: any) => e.name);

  schema.entities.forEach((entity: any, i: number) => {
    if (!entity.name) errors.push({ field: `entities[${i}].name`, message: 'entity name is required', type: 'missing_field' });
    if (!entity.tableName) errors.push({ field: `entities[${i}].tableName`, message: 'tableName is required', type: 'missing_field' });
    if (!Array.isArray(entity.fields)) errors.push({ field: `entities[${i}].fields`, message: 'fields must be an array', type: 'wrong_type' });

    // Check tenantId exists
    const hasTenantId = entity.fields?.some((f: any) => f.name === 'tenantId');
    if (!hasTenantId) errors.push({ field: `entities[${i}].fields`, message: `${entity.name} missing tenantId field`, type: 'missing_field' });

    // Check relations reference valid entities
    entity.relations?.forEach((rel: any, j: number) => {
      if (!entityNames.includes(rel.target)) {
        errors.push({ field: `entities[${i}].relations[${j}]`, message: `Relation target ${rel.target} does not exist`, type: 'broken_reference' });
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

// Validate Stage 3 output
export function validateAppSpec(appSpec: any, schema: DataSchema): ValidationResult {
  const errors: ValidationError[] = [];
  const entityNames = schema.entities.map(e => e.name);

  if (!Array.isArray(appSpec.pages)) errors.push({ field: 'pages', message: 'pages array is required', type: 'missing_field' });
  if (!Array.isArray(appSpec.apiEndpoints)) errors.push({ field: 'apiEndpoints', message: 'apiEndpoints array is required', type: 'missing_field' });
  if (!Array.isArray(appSpec.authRules)) errors.push({ field: 'authRules', message: 'authRules array is required', type: 'missing_field' });

  // Check every page has an API endpoint
  appSpec.pages?.forEach((page: any, i: number) => {
    const hasEndpoint = appSpec.apiEndpoints?.some(
      (ep: any) => ep.boundEntity === page.boundEntity
    );
    if (!hasEndpoint) {
      errors.push({ field: `pages[${i}]`, message: `Page ${page.name} has no corresponding API endpoint`, type: 'inconsistency' });
    }

    // Check boundEntity exists
    if (page.boundEntity && !entityNames.includes(page.boundEntity)) {
      errors.push({ field: `pages[${i}].boundEntity`, message: `boundEntity ${page.boundEntity} not in schema`, type: 'broken_reference' });
    }
  });

  // Check workflowStubs reference valid entities
  appSpec.workflowStubs?.forEach((stub: any, i: number) => {
    if (!entityNames.includes(stub.trigger?.entity)) {
      errors.push({ field: `workflowStubs[${i}]`, message: `WorkflowStub entity ${stub.trigger?.entity} not in schema`, type: 'broken_reference' });
    }
  });

  return { valid: errors.length === 0, errors };
}