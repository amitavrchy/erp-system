'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { crmSections } from '@/lib/crm';
import { ArrowUpRight, Workflow } from 'lucide-react';
export function CrmNav() {
  const path = usePathname();
  return (
    <>
      <div className="crm-context">
        <div className="row">
          <span className="crm-context-icon">
            <Workflow size={18} />
          </span>
          <strong>Customer workspace</strong>
          <span className="muted">/</span>
          <span className="muted">Grow every relationship</span>
        </div>
        <Link href="/app/sales/quotes" className="row link">
          Sales documents <ArrowUpRight size={15} />
        </Link>
      </div>
      <nav className="crm-navigation" aria-label="CRM navigation">
        {crmSections.map(([label, key]) => {
          const active =
            key === 'calendar'
              ? path.includes('/calendar') || path.includes('/activities')
              : key === 'campaigns'
                ? path.includes('/campaigns') || path.includes('/segments')
                : key === 'pipelines'
                  ? ['pipelines', 'automations', 'fields', 'import'].some((k) =>
                      path.includes('/' + k),
                    )
                  : path === `/app/crm/${key}` || path.startsWith(`/app/crm/${key}/`);
          return (
            <Link
              key={key}
              href={`/app/crm/${key}`}
              className={active ? 'active' : ''}
              aria-current={active ? 'page' : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
