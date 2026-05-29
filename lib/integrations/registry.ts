export interface IntegrationAction {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
}

export interface IntegrationTrigger {
  id: string;
  name: string;
  description: string;
  entityEvents: ('created' | 'updated' | 'deleted' | 'status_changed')[];
}

export interface Integration {
  id: string;
  displayName: string;
  authType: 'oauth2' | 'api_key' | 'webhook_secret' | 'none';
  triggers: IntegrationTrigger[];
  actions: IntegrationAction[];
  implemented: boolean;
  stubNote?: string;
}

export const INTEGRATION_REGISTRY: Record<string, Integration> = {
  slack: {
    id: 'slack',
    displayName: 'Slack',
    authType: 'oauth2',
    implemented: true,
    triggers: [
      { id: 'record_created', name: 'Record Created', description: 'Triggered when a record is created', entityEvents: ['created'] },
      { id: 'record_updated', name: 'Record Updated', description: 'Triggered when a record is updated', entityEvents: ['updated', 'status_changed'] },
    ],
    actions: [
      {
        id: 'send_channel_message',
        name: 'Send Channel Message',
        description: 'Send a message to a Slack channel',
        inputSchema: { channel: 'string', message: 'string', blocks: 'object?' },
        outputSchema: { messageId: 'string', timestamp: 'string' },
      },
      {
        id: 'send_dm',
        name: 'Send Direct Message',
        description: 'Send a DM to a Slack user',
        inputSchema: { userId: 'string', message: 'string' },
        outputSchema: { messageId: 'string' },
      },
    ],
  },

  stripe: {
    id: 'stripe',
    displayName: 'Stripe',
    authType: 'api_key',
    implemented: true,
    triggers: [
      { id: 'payment_event', name: 'Payment Event', description: 'Triggered on payment or subscription events', entityEvents: ['created', 'updated'] },
    ],
    actions: [
      {
        id: 'create_customer',
        name: 'Create Customer',
        description: 'Create a Stripe customer',
        inputSchema: { email: 'string', name: 'string', metadata: 'object?' },
        outputSchema: { customerId: 'string' },
      },
      {
        id: 'create_subscription',
        name: 'Create Subscription',
        description: 'Create a subscription for a customer',
        inputSchema: { customerId: 'string', priceId: 'string' },
        outputSchema: { subscriptionId: 'string', status: 'string' },
      },
    ],
  },

  whatsapp: {
    id: 'whatsapp',
    displayName: 'WhatsApp (via Twilio)',
    authType: 'api_key',
    implemented: true,
    triggers: [
      { id: 'user_action', name: 'User Action', description: 'Triggered by user action in app', entityEvents: ['created', 'status_changed'] },
    ],
    actions: [
      {
        id: 'send_template_message',
        name: 'Send Template Message',
        description: 'Send a WhatsApp template message',
        inputSchema: { to: 'string', templateName: 'string', variables: 'object' },
        outputSchema: { messageId: 'string', status: 'string' },
      },
    ],
  },

  gmail: {
    id: 'gmail',
    displayName: 'Gmail / Google Workspace',
    authType: 'oauth2',
    implemented: true,
    triggers: [
      { id: 'record_event', name: 'Record Event', description: 'Triggered by record events', entityEvents: ['created', 'updated'] },
    ],
    actions: [
      {
        id: 'send_email',
        name: 'Send Email',
        description: 'Send an email via Gmail',
        inputSchema: { to: 'string', subject: 'string', body: 'string', cc: 'string?' },
        outputSchema: { messageId: 'string' },
      },
      {
        id: 'create_calendar_event',
        name: 'Create Calendar Event',
        description: 'Create a Google Calendar event',
        inputSchema: { title: 'string', startTime: 'string', endTime: 'string', attendees: 'string[]' },
        outputSchema: { eventId: 'string' },
      },
    ],
  },

  webhook: {
    id: 'webhook',
    displayName: 'Webhook (Generic)',
    authType: 'webhook_secret',
    implemented: true,
    triggers: [
      { id: 'any_trigger', name: 'Any Trigger', description: 'Any entity event', entityEvents: ['created', 'updated', 'deleted', 'status_changed'] },
    ],
    actions: [
      {
        id: 'post_payload',
        name: 'POST Payload',
        description: 'POST a payload to a configured URL with HMAC signature',
        inputSchema: { url: 'string', payload: 'object', secret: 'string' },
        outputSchema: { statusCode: 'number', response: 'object' },
      },
    ],
  },

  notion: {
    id: 'notion',
    displayName: 'Notion',
    authType: 'oauth2',
    implemented: false,
    stubNote: 'Registry and schema defined. HTTP calls not implemented.',
    triggers: [
      { id: 'data_change', name: 'Data Change', description: 'Triggered on data change', entityEvents: ['created', 'updated'] },
    ],
    actions: [
      {
        id: 'create_page',
        name: 'Create Page',
        description: 'Create a Notion page',
        inputSchema: { databaseId: 'string', properties: 'object' },
        outputSchema: { pageId: 'string' },
      },
    ],
  },

  airtable: {
    id: 'airtable',
    displayName: 'Airtable',
    authType: 'api_key',
    implemented: false,
    stubNote: 'Registry and schema defined. HTTP calls not implemented.',
    triggers: [
      { id: 'record_event', name: 'Record Event', description: 'Triggered by record events', entityEvents: ['created', 'updated'] },
    ],
    actions: [
      {
        id: 'create_record',
        name: 'Create Record',
        description: 'Create an Airtable record',
        inputSchema: { baseId: 'string', tableId: 'string', fields: 'object' },
        outputSchema: { recordId: 'string' },
      },
    ],
  },

  hubspot: {
    id: 'hubspot',
    displayName: 'HubSpot',
    authType: 'oauth2',
    implemented: false,
    stubNote: 'Registry and schema defined. HTTP calls not implemented.',
    triggers: [
      { id: 'contact_event', name: 'Contact Event', description: 'Contact or deal event', entityEvents: ['created', 'updated'] },
    ],
    actions: [
      {
        id: 'create_contact',
        name: 'Create Contact',
        description: 'Create a HubSpot contact',
        inputSchema: { email: 'string', firstName: 'string', lastName: 'string' },
        outputSchema: { contactId: 'string' },
      },
    ],
  },
};

export function getIntegration(id: string): Integration | null {
  return INTEGRATION_REGISTRY[id] || null;
}

export function validateIntegrationHook(integrationId: string, actionId: string): boolean {
  const integration = getIntegration(integrationId);
  if (!integration) return false;
  return integration.actions.some(a => a.id === actionId);
}