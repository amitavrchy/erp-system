import type { Entity } from './types';
export interface CrmStage {
  id: string;
  name: string;
  position: number;
  probability: number;
  outcome: 'OPEN' | 'WON' | 'LOST';
  pipelineId: string;
  _count?: { deals: number };
}
export interface CrmPipeline {
  id: string;
  name: string;
  stages: CrmStage[];
}
export interface CrmField {
  id: string;
  name: string;
  key: string;
  entity: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';
  options: string[];
  required: boolean;
}
export interface CrmMeta {
  pipelines: CrmPipeline[];
  members: { id: string; name: string; email: string }[];
  fields: CrmField[];
}
export interface CrmRow {
  id: string;
  name: string;
  number?: string;
  status?: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  score?: number;
  value?: string;
  ownerId?: string;
  tags?: string[];
  notes?: string;
  customFields?: Record<string, string | number | null>;
  contactId?: string;
  contact?: Entity;
  leadId?: string;
  lead?: CrmRow;
  dealId?: string;
  deal?: CrmRow;
  stageId?: string;
  stage?: CrmStage & { pipeline?: CrmPipeline };
  expectedClose?: string;
  closedAt?: string;
  quoteId?: string;
  priority?: string;
  type?: string;
  dueAt?: string;
  startsAt?: string;
  endsAt?: string;
  outcome?: string;
  lostReason?: string;
  category?: string;
  channel?: string;
  resolution?: string;
  resolvedAt?: string;
  budget?: string;
  spent?: string;
  subject?: string;
  body?: string;
  segmentId?: string;
  segment?: CrmRow;
  lifecycle?: string;
  tag?: string;
  trigger?: string;
  action?: string;
  taskTitle?: string;
  dueDays?: number;
  enabled?: boolean;
  runCount?: number;
  lastRunAt?: string;
  key?: string;
  entity?: string;
  options?: string[];
  required?: boolean;
  createdAt?: string;
  updatedAt?: string;
  tasks?: CrmRow[];
  activities?: CrmRow[];
  deals?: CrmRow[];
  replies?: { id: string; body: string; isInternal: boolean; userId: string; createdAt: string }[];
}
export interface CrmPageData {
  data: CrmRow[];
  meta: { page: number; pageSize: number; total: number };
}
export interface CrmSummary {
  leads: number;
  newLeads: number;
  convertedLeads: number;
  openDeals: number;
  pipelineValue: number;
  weightedValue: number;
  wonValue: number;
  winRate: number;
  overdueTasks: number;
  completedActivities: number;
  activeCampaigns: number;
  tasks: { status: string; _count: number }[];
  tickets: { status: string; _count: number }[];
  sources: { name: string; total: number }[];
  stages: CrmStage[];
  recentDeals: CrmRow[];
}
export type CrmKind =
  | 'leads'
  | 'deals'
  | 'tasks'
  | 'activities'
  | 'campaigns'
  | 'tickets'
  | 'segments'
  | 'automations'
  | 'fields';
export const crmKinds: CrmKind[] = [
  'leads',
  'deals',
  'tasks',
  'activities',
  'campaigns',
  'tickets',
  'segments',
  'automations',
  'fields',
];
export const crmSections = [
  ['Overview', 'overview'],
  ['Leads', 'leads'],
  ['Deals', 'deals'],
  ['Contacts', 'contacts'],
  ['Companies', 'companies'],
  ['Tasks', 'tasks'],
  ['Calendar', 'calendar'],
  ['Marketing', 'campaigns'],
  ['Support', 'tickets'],
  ['Analytics', 'analytics'],
  ['Settings', 'pipelines'],
] as const;
export const crmConfig: Record<
  CrmKind,
  { title: string; singular: string; description: string; statuses: string[]; admin?: boolean }
> = {
  leads: {
    title: 'Leads',
    singular: 'lead',
    description: 'Find the right people. Start the right conversations.',
    statuses: ['NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED'],
  },
  deals: {
    title: 'Deal pipeline',
    singular: 'deal',
    description: 'Every opportunity, with a clear next step.',
    statuses: [],
  },
  tasks: {
    title: 'Tasks & follow-ups',
    singular: 'task',
    description: 'Keep your promises and your next steps in view.',
    statuses: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  },
  activities: {
    title: 'Activity log',
    singular: 'activity',
    description: 'Calls, meetings and conversations. One shared history.',
    statuses: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
  },
  campaigns: {
    title: 'Campaign workspace',
    singular: 'campaign',
    description: 'Plan your outreach, define an audience and track your spend.',
    statuses: ['DRAFT', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED'],
  },
  tickets: {
    title: 'Customer support',
    singular: 'ticket',
    description: 'A shared queue. A clear owner. A better customer experience.',
    statuses: ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'],
  },
  segments: {
    title: 'Audience segments',
    singular: 'segment',
    description: 'Dynamic groups that keep your customer context together.',
    statuses: [],
  },
  automations: {
    title: 'Workflow automations',
    singular: 'automation',
    description: 'Turn important moments into timely follow-ups.',
    statuses: [],
    admin: true,
  },
  fields: {
    title: 'Custom fields',
    singular: 'field',
    description: 'Capture the details that make your business different.',
    statuses: [],
    admin: true,
  },
};
export const humanize = (value?: string) =>
  value
    ? value
        .toLowerCase()
        .replaceAll('_', ' ')
        .replace(/^./, (s) => s.toUpperCase())
    : '—';
