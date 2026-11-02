'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  ArrowUpRight,
  Menu,
  X,
  LoaderCircle,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { navigation, visibleNavigation, canRead, canWrite, documentHref } from '@/lib/modules';
import { useWorkspace } from '@/hooks/use-workspace';
import { api, setToken, errorMessage } from '@/lib/api';
import { preferences, session, activeOrg, type RootState, type Dispatch } from '@/store';
import type { Me, Entity, PageData } from '@/lib/types';
import { Button, Modal } from './ui';

function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const timeout = setTimeout(() => setTerm(q), 200);
    return () => clearTimeout(timeout);
  }, [q]);
  const { orgId, user } = useWorkspace();
  const search = useQuery({
    queryKey: ['org', orgId, 'search', term],
    enabled: open && term.length >= 2,
    queryFn: async () => {
      const resources = [
        'contacts',
        'products',
        'quotes',
        'sales-orders',
        'invoices',
        'crm/leads',
        'crm/deals',
        'crm/tickets',
      ].filter((r) => canRead(user?.role ?? 'VIEWER', r));
      const results = await Promise.all(
        resources.map(async (resource) => {
          const r = await api.get<PageData>(`/${resource}`, { params: { q: term, pageSize: 5 } });
          return r.data.data.map((item) => ({ ...item, resource }));
        }),
      );
      return results.flat();
    },
  });
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Find your next step"
      description="Navigate, find a customer or search a document number."
    >
      <div
        onKeyDown={(e) => {
          if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
          e.preventDefault();
          const links = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>('a'));
          const i = links.indexOf(document.activeElement as HTMLAnchorElement);
          links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]?.focus();
        }}
      >
        <div className="row">
          <Search size={20} />
          <input
            className="command-input"
            aria-label="Search workspace"
            autoComplete="off"
            placeholder="Search anything…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd>esc</kbd>
        </div>
        <div className="command-list">
          {visibleNavigation(user?.role ?? 'VIEWER')
            .filter((n) => n.label.toLowerCase().includes(q.toLowerCase()))
            .map(({ href, Icon, label }) => (
              <Link key={href} href={href} className="command-item" onClick={() => setOpen(false)}>
                <Icon size={18} />
                {label}
                <ArrowRight size={16} />
              </Link>
            ))}
          {[
            { label: 'New lead', href: '/app/crm/leads?new=true', roles: ['SALES'] as const },
            { label: 'New deal', href: '/app/crm/deals?new=true', roles: ['SALES'] as const },
            { label: 'New task', href: '/app/crm/tasks?new=true', roles: ['SALES'] as const },
            { label: 'New ticket', href: '/app/crm/tickets?new=true', roles: ['SALES'] as const },
            { label: 'New quote', href: '/app/sales/quotes?new=true', roles: ['SALES'] as const },
            {
              label: 'New invoice',
              href: '/app/finance/invoices?new=true',
              roles: ['FINANCE'] as const,
            },
            {
              label: 'New product',
              href: '/app/inventory/products?new=true',
              roles: ['INVENTORY'] as const,
            },
            { label: 'New contact', href: '/app/crm/contacts?new=true', roles: ['SALES'] as const },
            {
              label: 'New purchase order',
              href: '/app/purchasing/pos?new=true',
              roles: ['INVENTORY'] as const,
            },
          ]
            .filter(
              (c) =>
                user &&
                canWrite(user.role, [...c.roles]) &&
                c.label.toLowerCase().includes(q.toLowerCase()),
            )
            .map((c) => (
              <a href={c.href} key={c.href} className="command-item">
                <Plus size={18} />
                {c.label}
                <ArrowRight size={16} />
              </a>
            ))}
          {search.isFetching && <p className="muted">Searching…</p>}
          {search.data?.map((item: Entity & { resource: string }) => (
            <Link
              key={item.id}
              className="command-item"
              onClick={() => setOpen(false)}
              href={
                item.resource.startsWith('crm/')
                  ? `/app/${item.resource}/${item.id}`
                  : ['contacts', 'products'].includes(item.resource)
                    ? `/app/${item.resource === 'contacts' ? 'crm/contacts' : 'inventory/products'}/${item.id}`
                    : documentHref(item.resource, item.id)
              }
            >
              <Search size={17} />
              {item.name ?? item.number}
              <span className="muted">{item.resource}</span>
            </Link>
          ))}
          {q.length >= 2 && !search.isFetching && !search.data?.length && (
            <p className="muted" style={{ padding: 12 }}>
              No matching records. Try another name or document number.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const dispatch = useDispatch<Dispatch>();
  const cache = useQueryClient();
  const { user, org } = useWorkspace();
  const { ready } = useSelector((s: RootState) => s.auth);
  const ui = useSelector((s: RootState) => s.ui);
  const [palette, setPalette] = useState(false);
  const [mobile, setMobile] = useState(false);
  const current = navigation.find((n) =>
    n.href === '/app' ? path === '/app' : path.startsWith(n.href.split('/').slice(0, 3).join('/')),
  );
  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const editable = (e.target as HTMLElement)?.closest(
        'input,textarea,select,[contenteditable]',
      );
      if (((e.metaKey || e.ctrlKey) && e.key === 'k') || (!editable && e.key === '/')) {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (e.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);
  async function logout() {
    try {
      await api.post('/auth/logout');
      setToken(null);
      cache.clear();
      dispatch(session(null));
      router.push('/login');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function switchOrg(id: string) {
    try {
      const r = await api.post<{ accessToken: string }>(`/auth/switch/${id}`);
      setToken(r.data.accessToken);
      const me = await api.get<Me>('/me');
      cache.clear();
      dispatch(session(me.data));
      dispatch(activeOrg(id));
      router.push('/app');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  if (!ready || !user)
    return (
      <div className="loading-screen">
        <LoaderCircle className="spin muted" size={28} aria-label="Loading workspace" />
      </div>
    );
  return (
    <div className={`shell ${ui.collapsed ? 'collapsed' : ''} ${mobile ? 'mobile-open' : ''}`}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {mobile && (
        <button
          className="mobile-nav-backdrop"
          aria-label="Dismiss navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className="sidebar">
        <Link href="/app" className="brand">
          <span className="brand-mark">l</span>
          <span className="hide-collapsed">ledgerflow</span>
        </Link>
        <div className="workspace-switch">
          <span className="workspace-avatar">{org?.name.slice(0, 1)}</span>
          <select
            className="hide-collapsed"
            aria-label="Active workspace"
            value={user.activeOrgId}
            onChange={(e) => switchOrg(e.target.value)}
          >
            {user.memberships.map((m) => (
              <option value={m.organization.id} key={m.organization.id}>
                {m.organization.name}
              </option>
            ))}
          </select>
        </div>
        <p className="nav-label hide-collapsed">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {visibleNavigation(user.role).map(({ href, label, Icon }) => {
            const active =
              href === '/app'
                ? path === href
                : path.startsWith(href.split('/').slice(0, 3).join('/'));
            return (
              <Link
                title={ui.collapsed ? label : undefined}
                className={`nav-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                href={href}
                key={href}
                onClick={() => setMobile(false)}
              >
                <Icon size={19} />
                <span className="hide-collapsed">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note hide-collapsed">
            <div className="row">
              <span className="live-dot" />
              <strong>A little more in flow.</strong>
            </div>
            <p className="muted">Your next good decision starts with a clear picture.</p>
            <Link
              href={canRead(user.role, 'reports') ? '/app/reports' : '/app/inventory/products'}
              className="link row"
            >
              Explore your workspace <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="user-block row">
            <span className="avatar">
              {user.name
                .split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div className="hide-collapsed">
              <div className="user-name">{user.name}</div>
              <div className="muted" style={{ textTransform: 'capitalize' }}>
                {user.role.toLowerCase()}
              </div>
            </div>
            <Button
              variant="ghost"
              className="icon-button hide-collapsed"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <header className="topbar">
          <div className="row">
            <Button
              className="mobile-menu icon-button"
              variant="ghost"
              aria-label={mobile ? 'Close navigation' : 'Open navigation'}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X size={19} /> : <Menu size={19} />}
            </Button>
            <Button
              className="desktop-only icon-button"
              variant="ghost"
              aria-label="Toggle sidebar"
              onClick={() => dispatch(preferences({ collapsed: !ui.collapsed }))}
            >
              {ui.collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </Button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{current?.label ?? 'Overview'}</strong>
            </div>
          </div>
          <div className="row">
            <button
              className="search-trigger"
              onClick={() => setPalette(true)}
              aria-label="Search workspace"
            >
              <Search size={16} />
              <span>Search anything…</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="topbar-divider" />
            <Button
              variant="ghost"
              className="icon-button"
              aria-label="Toggle color theme"
              onClick={() =>
                dispatch(preferences({ theme: ui.theme === 'dark' ? 'light' : 'dark' }))
              }
            >
              {ui.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <span className="avatar desktop-only">{user.name[0]}</span>
          </div>
        </header>
        <main id="main" className="main-content" key={path}>
          {children}
        </main>
      </div>
      <CommandPalette open={palette} setOpen={setPalette} />
    </div>
  );
}
