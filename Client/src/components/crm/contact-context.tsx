'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Target, Clock3, Headphones } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { api, errorMessage, money, date } from '@/lib/api';
import { humanize, type CrmKind, type CrmRow } from '@/lib/crm';
import { canWrite } from '@/lib/modules';
import { Button, Skeleton, ErrorState } from '@/components/ui';
import { CrmDialog } from './crm-form';
export function ContactContext({ id }: { id: string }) {
  const { orgId, org, user } = useWorkspace();
  const [add, setAdd] = useState<CrmKind>();
  const query = useQuery({
    queryKey: ['org', orgId, 'crm', 'contacts', id, 'context'],
    queryFn: () =>
      api
        .get<{
          leads: CrmRow[];
          deals: CrmRow[];
          tasks: CrmRow[];
          activities: CrmRow[];
          tickets: CrmRow[];
        }>(`/crm/contacts/${id}/context`)
        .then((r) => r.data),
    enabled: !!orgId,
  });
  const allowed = user && canWrite(user.role, ['SALES']);
  return (
    <section className="panel dashboard-bottom">
      <div className="panel-heading spread">
        <div>
          <h2>The whole relationship</h2>
          <p className="muted">Opportunities, follow-ups and customer care, connected.</p>
        </div>
        {allowed && (
          <Button onClick={() => setAdd('tasks')}>
            <Plus size={16} />
            Add follow-up
          </Button>
        )}
      </div>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} />
      ) : (
        <div className="panel-body crm-contact-context">
          {[
            ['deals', 'Opportunities', Target],
            ['tasks', 'Follow-ups', Clock3],
            ['tickets', 'Support', Headphones],
          ].map(([kind, label, Icon]) => {
            const K = kind as 'deals' | 'tasks' | 'tickets';
            const I = Icon as typeof Target;
            const rows = query.data[K];
            return (
              <div key={K}>
                <div className="spread">
                  <h3 className="row">
                    <I size={17} />
                    {String(label)}
                  </h3>
                  <span className="badge">{rows.length}</span>
                </div>
                {rows.length ? (
                  rows.map((r) => (
                    <div className="crm-contact-linked" key={r.id}>
                      {K === 'tasks' ? (
                        <strong>{r.name}</strong>
                      ) : (
                        <Link className="link" href={`/app/crm/${K}/${r.id}`}>
                          {r.name}
                        </Link>
                      )}
                      <p className="muted">
                        {K === 'deals'
                          ? money(r.value, org?.currency)
                          : date(r.dueAt ?? r.createdAt)}{' '}
                        · {humanize(r.stage?.outcome ?? r.status)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="muted" style={{ marginTop: 15 }}>
                    No {String(label).toLowerCase()} yet.
                  </p>
                )}
                {allowed && (
                  <Button variant="ghost" style={{ marginTop: 12 }} onClick={() => setAdd(K)}>
                    <Plus size={15} />
                    Add {K === 'deals' ? 'deal' : K === 'tasks' ? 'task' : 'ticket'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {query.data?.activities.length ? (
        <div className="panel-body" style={{ borderTop: '1px solid var(--border)' }}>
          <h3>Recent conversations</h3>
          {query.data.activities.map((a) => (
            <div className="crm-contact-linked" key={a.id}>
              <strong>{a.name}</strong>
              <p className="muted">
                {humanize(a.type)} · {date(a.startsAt)} · {humanize(a.status)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {add && <CrmDialog kind={add} defaults={{ contactId: id }} close={() => setAdd(undefined)} />}
    </section>
  );
}
