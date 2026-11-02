export type Role = 'OWNER' | 'ADMIN' | 'SALES' | 'INVENTORY' | 'FINANCE' | 'VIEWER';
export interface Organization {
  id: string;
  name: string;
  currency: string;
  timezone: string;
}
export interface Me {
  id: string;
  name: string;
  email: string;
  role: Role;
  activeOrgId: string;
  memberships: { role: Role; organization: Organization }[];
}
export interface Line {
  id?: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number | string;
  taxBps: number;
  quantityReceived?: number;
}
export interface Entity {
  lifecycle?: string;
  source?: string;
  ownerId?: string;
  customFields?: Record<string, string | number | null>;
  id: string;
  name?: string;
  number?: string;
  email?: string;
  phone?: string;
  title?: string;
  sku?: string;
  description?: string;
  website?: string;
  notes?: string;
  code?: string;
  status?: string;
  total?: string;
  amountPaid?: string;
  amount?: string;
  method?: string;
  unitPrice?: string;
  costPrice?: string;
  reorderPoint?: number;
  isActive?: boolean;
  rateBps?: number;
  quantity?: number;
  value?: number;
  type?: string;
  reason?: string;
  reference?: string;
  createdAt?: string;
  paidAt?: string;
  dueDate?: string;
  issueDate?: string;
  contactId?: string;
  companyId?: string;
  vendorId?: string;
  vendorName?: string;
  contact?: Entity;
  company?: Entity;
  vendor?: Entity;
  product?: Entity;
  warehouse?: Entity;
  attrsJson?: Record<string, string>;
  metaJson?: { note?: string };
  stockLevels?: { quantity: number; warehouse: Entity }[];
  lines?: Line[];
  quote?: Entity;
  salesOrder?: Entity;
  invoices?: Entity[];
  allocations?: { amount: string; invoice?: Entity; payment?: Entity }[];
  action?: string;
  entityType?: string;
  entityId?: string;
  user?: { name: string };
  tags?: string[];
}
export interface PageData {
  data: Entity[];
  meta: { page: number; pageSize: number; total: number };
  valuation?: number;
}
export interface SalesReport {
  total: number;
  count: number;
  series: { date: string; total: number }[];
  topProducts: { name: string; total: number }[];
}
export interface DashboardData {
  revenue: number;
  openAR: number;
  ordersToday: number;
  stockAlerts: number;
  lowStock: Entity[];
  overdue: Entity[];
  pendingQuotes: number;
  activity: Entity[];
  recentInvoices: Entity[];
  sales: SalesReport;
}
