import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Package,
  Truck,
  Wallet,
  ChartNoAxesCombined,
  Settings2,
} from 'lucide-react';
import type { Role } from './types';
export const navigation = [
  { label: 'Overview', href: '/app', Icon: LayoutDashboard },
  { label: 'CRM', href: '/app/crm/overview', Icon: Users },
  { label: 'Sales', href: '/app/sales/quotes', Icon: ShoppingBag },
  { label: 'Inventory', href: '/app/inventory/products', Icon: Package },
  { label: 'Purchasing', href: '/app/purchasing/pos', Icon: Truck },
  { label: 'Finance', href: '/app/finance/invoices', Icon: Wallet },
  { label: 'Reports', href: '/app/reports', Icon: ChartNoAxesCombined },
  { label: 'Settings', href: '/app/settings', Icon: Settings2 },
];
export const modules: Record<
  string,
  {
    title: string;
    singular: string;
    endpoint: string;
    description: string;
    roles: Role[];
    document?: boolean;
    tabs: [string, string][];
  }
> = {
  contacts: {
    title: 'Contacts',
    singular: 'contact',
    endpoint: 'contacts',
    description: 'Good relationships start with a little clarity.',
    roles: ['SALES'],
    tabs: [
      ['Contacts', '/app/crm/contacts'],
      ['Companies', '/app/crm/companies'],
    ],
  },
  companies: {
    title: 'Companies',
    singular: 'company',
    endpoint: 'companies',
    description: 'The businesses behind your relationships.',
    roles: ['SALES'],
    tabs: [
      ['Contacts', '/app/crm/contacts'],
      ['Companies', '/app/crm/companies'],
    ],
  },
  products: {
    title: 'Products',
    singular: 'product',
    endpoint: 'products',
    description: 'Everything you sell, with stock you can trust.',
    roles: ['INVENTORY'],
    tabs: [
      ['Products', '/app/inventory/products'],
      ['Warehouses', '/app/inventory/warehouses'],
      ['Movements', '/app/inventory/movements'],
      ['Adjustments', '/app/inventory/adjustments'],
    ],
  },
  warehouses: {
    title: 'Warehouses',
    singular: 'warehouse',
    endpoint: 'warehouses',
    description: 'A place for every product.',
    roles: ['INVENTORY'],
    tabs: [
      ['Products', '/app/inventory/products'],
      ['Warehouses', '/app/inventory/warehouses'],
      ['Movements', '/app/inventory/movements'],
      ['Adjustments', '/app/inventory/adjustments'],
    ],
  },
  movements: {
    title: 'Stock movements',
    singular: 'movement',
    endpoint: 'stock/movements',
    description: 'Every unit in. Every unit out. All accounted for.',
    roles: [],
    tabs: [
      ['Products', '/app/inventory/products'],
      ['Warehouses', '/app/inventory/warehouses'],
      ['Movements', '/app/inventory/movements'],
      ['Adjustments', '/app/inventory/adjustments'],
    ],
  },
  adjustments: {
    title: 'Stock adjustments',
    singular: 'adjustment',
    endpoint: 'stock/movements',
    description: 'Keep your physical stock and records in sync.',
    roles: ['INVENTORY'],
    tabs: [
      ['Products', '/app/inventory/products'],
      ['Warehouses', '/app/inventory/warehouses'],
      ['Movements', '/app/inventory/movements'],
      ['Adjustments', '/app/inventory/adjustments'],
    ],
  },
  quotes: {
    title: 'Quotes',
    singular: 'quote',
    endpoint: 'quotes',
    description: 'Turn a good conversation into your next opportunity.',
    roles: ['SALES'],
    document: true,
    tabs: [
      ['Quotes', '/app/sales/quotes'],
      ['Sales orders', '/app/sales/orders'],
    ],
  },
  orders: {
    title: 'Sales orders',
    singular: 'order',
    endpoint: 'sales-orders',
    description: 'From a yes to out the door.',
    roles: ['SALES'],
    document: true,
    tabs: [
      ['Quotes', '/app/sales/quotes'],
      ['Sales orders', '/app/sales/orders'],
    ],
  },
  invoices: {
    title: 'Invoices',
    singular: 'invoice',
    endpoint: 'invoices',
    description: 'Clear invoices. Healthy cash flow.',
    roles: ['FINANCE'],
    document: true,
    tabs: [
      ['Invoices', '/app/finance/invoices'],
      ['Bills', '/app/finance/bills'],
      ['Payments', '/app/finance/payments'],
      ['Accounts', '/app/finance/accounts'],
    ],
  },
  vendors: {
    title: 'Vendors',
    singular: 'vendor',
    endpoint: 'vendors',
    description: 'The partners that keep your business moving.',
    roles: ['INVENTORY'],
    tabs: [
      ['Purchase orders', '/app/purchasing/pos'],
      ['Vendors', '/app/purchasing/vendors'],
    ],
  },
  pos: {
    title: 'Purchase orders',
    singular: 'purchase order',
    endpoint: 'purchase-orders',
    description: 'Know what’s on its way, before it arrives.',
    roles: ['INVENTORY'],
    document: true,
    tabs: [
      ['Purchase orders', '/app/purchasing/pos'],
      ['Vendors', '/app/purchasing/vendors'],
    ],
  },
  payments: {
    title: 'Payments',
    singular: 'payment',
    endpoint: 'payments',
    description: 'Every payment, connected to its invoice.',
    roles: [],
    tabs: [
      ['Invoices', '/app/finance/invoices'],
      ['Bills', '/app/finance/bills'],
      ['Payments', '/app/finance/payments'],
      ['Accounts', '/app/finance/accounts'],
    ],
  },
  bills: {
    title: 'Bills',
    singular: 'bill',
    endpoint: 'bills',
    description: 'Stay on top of what you owe.',
    roles: [],
    tabs: [
      ['Invoices', '/app/finance/invoices'],
      ['Bills', '/app/finance/bills'],
      ['Payments', '/app/finance/payments'],
      ['Accounts', '/app/finance/accounts'],
    ],
  },
};
export const canWrite = (role: Role, roles: Role[]) => ['OWNER', 'ADMIN', ...roles].includes(role);
export function documentHref(endpoint: string, id: string) {
  const prefix =
    endpoint === 'quotes'
      ? '/app/sales/quotes'
      : endpoint === 'sales-orders'
        ? '/app/sales/orders'
        : endpoint === 'invoices'
          ? '/app/finance/invoices'
          : '/app/purchasing/pos';
  return `${prefix}/${id}`;
}

export function canRead(role: Role, endpoint: string) {
  endpoint = ['movements', 'adjustments'].includes(endpoint) ? 'stock' : endpoint;
  if (role === 'SALES')
    return [
      'contacts',
      'companies',
      'products',
      'warehouses',
      'stock',
      'quotes',
      'sales-orders',
      'invoices',
      'tax-rates',
    ].includes(endpoint.split('/')[0]);
  if (role === 'INVENTORY')
    return [
      'products',
      'warehouses',
      'stock',
      'vendors',
      'purchase-orders',
      'sales-orders',
      'tax-rates',
    ].includes(endpoint.split('/')[0]);
  return true;
}
export function visibleNavigation(role: Role) {
  return navigation
    .filter((n) =>
      role === 'SALES'
        ? !['Purchasing', 'Finance', 'Reports'].includes(n.label)
        : role === 'INVENTORY'
          ? !['CRM', 'Finance', 'Reports'].includes(n.label)
          : true,
    )
    .map((n) =>
      role === 'INVENTORY' && n.label === 'Sales' ? { ...n, href: '/app/sales/orders' } : n,
    );
}
