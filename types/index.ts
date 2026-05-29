// App Intent - Output of Stage 1
export interface AppIntent {
  appName: string;
  appType: 'crm' | 'project_management' | 'ecommerce' | 'hr_tool' | 'inventory' | 'content_platform' | 'analytics' | 'custom';
  features: string[];
  entities: string[];
  integrations_requested: string[];
  assumptions: string[];
  clarification_required?: {
    flag: boolean;
    question: string;
  };
}

// Data Schema - Output of Stage 2
export interface EntityField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'uuid' | 'text' | 'enum';
  nullable: boolean;
  isRelation: boolean;
  isPrimary: boolean;
  isUnique: boolean;
}

export interface EntityRelation {
  type: 'hasMany' | 'belongsTo' | 'hasOne';
  target: string;
  foreignKey: string;
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT';
}

export interface EntitySchema {
  name: string;
  tableName: string;
  fields: EntityField[];
  relations: EntityRelation[];
}

export interface DataSchema {
  entities: EntitySchema[];
}

// App Spec - Output of Stage 3
export interface Page {
  name: string;
  route: string;
  layout: 'list' | 'detail' | 'dashboard' | 'settings';
  boundEntity: string;
  components: ('table' | 'form' | 'chart' | 'card')[];
}

export interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handlerDescription: string;
  boundEntity: string;
  authRequired: boolean;
  rateLimitFlag: boolean;
}

export interface AuthRule {
  role: string;
  permissions: {
    entity: string;
    read: boolean;
    write: boolean;
    delete: boolean;
  }[];
}

export interface IntegrationHook {
  integrationId: string;
  trigger: string;
  action: string;
}

export interface WorkflowStub {
  name: string;
  trigger: {
    entity: string;
    event: 'created' | 'updated' | 'deleted' | 'status_changed';
    condition?: string;
  };
  integration: string;
  action: string;
  payload: Record<string, string>;
}

export interface AppSpec {
  pages: Page[];
  apiEndpoints: ApiEndpoint[];
  authRules: AuthRule[];
  integrationHooks: IntegrationHook[];
  workflowStubs: WorkflowStub[];
}

// Job Status
export type JobStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface StageResult {
  stage: string;
  status: 'running' | 'complete' | 'failed';
  output?: any;
  error?: string;
  latency?: number;
  tokens?: number;
  cost?: number;
  repairLog?: RepairLog[];
}

export interface RepairLog {
  strategy: 'structural' | 'field' | 'consistency';
  errorInput: string;
  outcome: 'repaired' | 'escalated' | 'failed';
}

export interface Job {
  id: string;
  prompt: string;
  status: JobStatus;
  stages: StageResult[];
  appSpec?: AppSpec;
  intent?: AppIntent;
  dataSchema?: DataSchema;
  totalCost?: number;
  totalLatency?: number;
  createdAt: number;
}