'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Mail,
  Phone,
  Building2,
  Target,
  Receipt,
  MessageSquare,
  Clock3,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, money, date } from '@/lib/api';
import { crmConfig, humanize, type CrmKind, type CrmRow } from '@/lib/crm';
import { canWrite } from '@/lib/modules';
import { useWorkspace } from '@/hooks/use-workspace';
import { useCrmMeta } from '@/hooks/use-crm';
import type { PageData } from '@/lib/types';
import { Button, Badge, Modal, Skeleton, Empty, ErrorState } from '@/components/ui';
import { CrmDialog, CustomInputs } from './crm-form';

export function CrmDetail({ kind, id }: { kind: CrmKind; id: string }) {
  const { user, org, orgId } = useWorkspace();
  const cache = useQueryClient();
  const router = useRouter();
  const meta = useCrmMeta();
  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState<CrmKind>();
  const [convert, setConvert] = useState(false);
  const [stageId, setStageId] = useState('');
  const [createDeal, setCreateDeal] = useState(true);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(true);
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['org', orgId, 'crm', kind, id],
    queryFn: () => api.get<CrmRow>(`/crm/${kind}/${id}`).then((r) => r.data),
    enabled: !!orgId,
  });
  const audience = useQuery({
    queryKey: ['org', orgId, 'crm', 'segments', id, 'audience'],
    queryFn: () =>
      api
        .get<PageData>(`/crm/segments/${id}/audience`, { params: { pageSize: 100 } })
        .then((r) => r.data),
    enabled: !!orgId && kind === 'segments',
  });
  if (query.isPending) return <Skeleton />;
  if (query.isError)
    return <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} />;
  const row = query.data;
  const allowed = user && canWrite(user.role, crmConfig[kind].admin ? [] : ['SALES']);
  const owner = meta.data?.members.find((m) => m.id === row.ownerId);
  const contactFields = meta.data?.fields.filter((f) => f.entity === 'contacts') ?? [];
  const stages =
    meta.data?.pipelines.flatMap((p) =>
      p.stages.filter((s) => s.outcome === 'OPEN').map((s) => ({ ...s, pipeline: p.name })),
    ) ?? [];
  const defaults = {
    name: `Follow up: ${row.name}`,
    ...(row.contactId ? { contactId: row.contactId } : {}),
    ...(kind === 'leads' ? { leadId: id } : kind === 'deals' ? { dealId: id } : {}),
  };
  async function convertLead(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ contactId: string; dealId?: string }>(`/crm/leads/${id}/convert`, {
        createDeal,
        stageId: stageId || stages[0]?.id,
        customFields: Object.fromEntries(
          contactFields.map((f) => [
            f.key,
            f.type === 'NUMBER' && customValues[f.key]
              ? Number(customValues[f.key])
              : (customValues[f.key] ?? ''),
          ]),
        ),
      });
      await cache.invalidateQueries({ queryKey: ['org', orgId] });
      toast.success('Lead converted. Your history stays connected.');
      setConvert(false);
      router.push(
        r.data.dealId ? `/app/crm/deals/${r.data.dealId}` : `/app/crm/contacts/${r.data.contactId}`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const related = [
    ...(row.tasks ?? []).map((r) => ({ ...r, kind: 'tasks' })),
    ...(row.activities ?? []).map((r) => ({ ...r, kind: 'activities' })),
    ...(row.deals ?? []).map((r) => ({ ...r, kind: 'deals' })),
  ];
  return (
    <>
      <Link href={`/app/crm/${kind}`} className="row muted" style={{ marginBottom: 20 }}>
        <ArrowLeft size={16} />
        Back to {crmConfig[kind].title.toLowerCase()}
      </Link>
      <div className="page-title spread">
        <div>
          <div className="row">
            <span className="crm-record-icon">
              {kind === 'tickets' ? <MessageSquare size={23} /> : <Target size={23} />}
            </span>
            <div>
              <h1>{row.name}</h1>
              <div className="row" style={{ marginTop: 7 }}>
                <span className="mono muted">{row.number ?? humanize(kind)}</span>
                <Badge status={row.stage?.outcome ?? row.status ?? 'ACTIVE'} />
                {row.stage && <span className="muted">{row.stage.name}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          {allowed && row.status !== 'CONVERTED' && (
            <Button onClick={() => setEdit(true)}>Edit {crmConfig[kind].singular}</Button>
          )}
          {kind === 'leads' &&
            allowed &&
            !['CONVERTED', 'DISQUALIFIED'].includes(row.status ?? '') && (
              <Button variant="primary" onClick={() => setConvert(true)}>
                Convert lead <ArrowRight size={17} />
              </Button>
            )}
          {kind === 'deals' && allowed && row.stage?.outcome !== 'LOST' && (
            <Button
              variant="primary"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await api.post<{ id: string }>(`/crm/deals/${id}/quote`);
                  await cache.invalidateQueries({ queryKey: ['org', orgId] });
                  router.push(`/app/sales/quotes/${r.data.id}`);
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Receipt size={17} />
              {row.quoteId ? 'Open quote' : 'Create quote'}
            </Button>
          )}
        </div>
      </div>
      {kind === 'deals' && (
        <div className="crm-deal-stage-strip">
          {meta.data?.pipelines
            .find((p) => p.id === row.stage?.pipelineId)
            ?.stages.map((s) => (
              <span key={s.id} className={s.id === row.stageId ? 'active' : ''}>
                {s.name}
              </span>
            ))}
        </div>
      )}
      <div className="detail-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel-heading spread">
              <h2>
                {kind === 'tickets'
                  ? 'Issue details'
                  : kind === 'campaigns'
                    ? 'Campaign brief'
                    : 'Relationship details'}
              </h2>
              <span className="muted">Created {date(row.createdAt)}</span>
            </div>
            <div className="panel-body">
              <div className="crm-record-properties">
                {(kind === 'leads' || kind === 'deals') && (
                  <div>
                    <span className="muted">
                      {kind === 'leads' ? 'Potential value' : 'Deal value'}
                    </span>
                    <strong className="crm-detail-value mono">
                      {money(row.value, org?.currency)}
                    </strong>
                  </div>
                )}
                {row.source && (
                  <div>
                    <span className="muted">Source</span>
                    <p>{humanize(row.source)}</p>
                  </div>
                )}
                {row.score !== undefined && (
                  <div>
                    <span className="muted">Lead score</span>
                    <p className="mono">{row.score} / 100</p>
                  </div>
                )}
                {row.expectedClose && (
                  <div>
                    <span className="muted">Expected close</span>
                    <p>{date(row.expectedClose)}</p>
                  </div>
                )}
                {row.priority && (
                  <div>
                    <span className="muted">Priority</span>
                    <p className={`crm-priority ${row.priority.toLowerCase()}`}>
                      {humanize(row.priority)}
                    </p>
                  </div>
                )}
                {row.dueAt && (
                  <div>
                    <span className="muted">Due date</span>
                    <p>{date(row.dueAt)}</p>
                  </div>
                )}
                {row.category && (
                  <div>
                    <span className="muted">Category</span>
                    <p>{humanize(row.category)}</p>
                  </div>
                )}
                {row.channel && (
                  <div>
                    <span className="muted">Channel</span>
                    <p>{humanize(row.channel)}</p>
                  </div>
                )}
                {kind === 'campaigns' && (
                  <>
                    <div>
                      <span className="muted">Budget</span>
                      <p className="mono">{money(row.budget, org?.currency)}</p>
                    </div>
                    <div>
                      <span className="muted">Actual spend</span>
                      <p className="mono">{money(row.spent, org?.currency)}</p>
                    </div>
                    <div>
                      <span className="muted">Audience</span>
                      <p>
                        {row.segment ? (
                          <Link className="link" href={`/app/crm/segments/${row.segment.id}`}>
                            {row.segment.name}
                          </Link>
                        ) : (
                          'Not selected'
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="muted">Campaign dates</span>
                      <p>
                        {date(row.startsAt)} — {date(row.endsAt)}
                      </p>
                    </div>
                  </>
                )}
                {Object.entries(row.customFields ?? {}).map(([key, value]) => (
                  <div key={key}>
                    <span className="muted">
                      {meta.data?.fields.find((f) => f.key === key && f.entity === kind)?.name ??
                        key}
                    </span>
                    <p>{String(value ?? '—')}</p>
                  </div>
                ))}
              </div>
              {row.notes && (
                <div className="crm-detail-notes">
                  <h3>{kind === 'tickets' ? 'Description' : 'Notes'}</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }} className="muted">
                    {row.notes}
                  </p>
                </div>
              )}
              {row.lostReason && (
                <div className="crm-detail-notes">
                  <h3>Loss reason</h3>
                  <p className="muted">{row.lostReason}</p>
                </div>
              )}
              {row.resolution && (
                <div className="crm-detail-notes">
                  <h3 className="positive">Resolution</h3>
                  <p className="muted">{row.resolution}</p>
                </div>
              )}
              {kind === 'campaigns' && (
                <div className="crm-detail-notes">
                  <h3>Message draft</h3>
                  <strong>{row.subject ?? 'No subject yet'}</strong>
                  <p className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>
                    {row.body ?? 'No draft message yet.'}
                  </p>
                  <p className="crm-disclosure">
                    Campaign planning is active. Email/SMS delivery and engagement tracking require
                    a connected provider.
                  </p>
                </div>
              )}
            </div>
          </section>
          {kind === 'segments' && (
            <section className="panel">
              <div className="panel-heading spread">
                <h2>Live audience</h2>
                <Badge status="DYNAMIC" />
              </div>
              {audience.isPending ? (
                <Skeleton />
              ) : audience.isError ? (
                <ErrorState
                  message={errorMessage(audience.error)}
                  retry={() => audience.refetch()}
                />
              ) : (
                <>
                  <div className="panel-body">
                    <p className="muted">
                      {audience.data?.meta.total ?? 0} contacts match this segment. Showing up to
                      100.
                    </p>
                    <p className="muted">
                      Lifecycle: {humanize(row.lifecycle)} · Tag: {row.tag ?? 'Any'} · Source:{' '}
                      {row.source ?? 'Any'}
                    </p>
                  </div>
                  {audience.data?.data.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Contact</th>
                            <th scope="col">Email</th>
                            <th scope="col">Tags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {audience.data.data.map((c) => (
                            <tr key={c.id}>
                              <td>
                                <Link className="table-link" href={`/app/crm/contacts/${c.id}`}>
                                  {c.name}
                                </Link>
                              </td>
                              <td>{c.email ?? '—'}</td>
                              <td>{c.tags?.join(', ') || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="No matching contacts yet"
                      description="Update the filters or add contacts with matching details."
                    />
                  )}
                </>
              )}
            </section>
          )}
          {['leads', 'deals'].includes(kind) && (
            <section className="panel">
              <div className="panel-heading spread">
                <h2>Follow-ups & conversations</h2>
                {allowed && (
                  <Button onClick={() => setAdd('tasks')}>
                    <Plus size={16} />
                    Add follow-up
                  </Button>
                )}
              </div>
              {related.length ? (
                <div className="panel-body">
                  {related.map((r) => (
                    <div className="crm-related-row" key={r.id}>
                      <span className="crm-stat-icon blue">
                        {r.kind === 'tasks' ? (
                          <CheckCircle2 size={17} />
                        ) : r.kind === 'activities' ? (
                          <Clock3 size={17} />
                        ) : (
                          <Target size={17} />
                        )}
                      </span>
                      <div style={{ flex: 1 }}>
                        <strong>{r.name}</strong>
                        <p className="muted">
                          {humanize(r.status ?? r.stage?.outcome)} ·{' '}
                          {date(r.dueAt ?? r.startsAt ?? r.createdAt)}
                        </p>
                      </div>
                      {r.kind === 'deals' && (
                        <Link href={`/app/crm/deals/${r.id}`} className="link">
                          Open
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Make the next move"
                  description="Add a call, schedule a meeting or create a follow-up."
                />
              )}
            </section>
          )}
          {kind === 'tickets' && (
            <section className="panel">
              <div className="panel-heading spread">
                <h2>Conversation & internal notes</h2>
                <span className="muted">Recorded in your workspace</span>
              </div>
              <div className="panel-body">
                <div className="crm-conversation">
                  {row.replies?.length ? (
                    row.replies.map((reply) => (
                      <article
                        key={reply.id}
                        className={`crm-message ${reply.isInternal ? 'internal' : ''}`}
                      >
                        <div className="spread">
                          <strong>
                            {meta.data?.members.find((m) => m.id === reply.userId)?.name ??
                              'Teammate'}
                          </strong>
                          <span className="badge">
                            {reply.isInternal ? 'Internal note' : 'Customer reply · recorded'}
                          </span>
                        </div>
                        <p style={{ whiteSpace: 'pre-wrap', margin: '12px 0' }}>{reply.body}</p>
                        <time className="muted">{new Date(reply.createdAt).toLocaleString()}</time>
                      </article>
                    ))
                  ) : (
                    <p className="muted">No messages recorded yet.</p>
                  )}
                </div>
                {allowed && (
                  <form
                    className="stack"
                    style={{ marginTop: 24 }}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setError('');
                      try {
                        await api.post(`/crm/tickets/${id}/replies`, {
                          body: message,
                          isInternal: internal,
                        });
                        setMessage('');
                        await cache.invalidateQueries({ queryKey: ['org', orgId] });
                        toast.success(internal ? 'Internal note added' : 'Customer reply recorded');
                      } catch (e) {
                        setError(errorMessage(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {error && (
                      <p role="alert" className="form-alert">
                        {error}
                      </p>
                    )}
                    <label>
                      Message type
                      <select
                        value={internal ? 'internal' : 'reply'}
                        onChange={(e) => setInternal(e.target.value === 'internal')}
                      >
                        <option value="internal">Internal note</option>
                        <option value="reply">Customer reply (record only)</option>
                      </select>
                    </label>
                    <label>
                      Message
                      <textarea
                        required
                        maxLength={10000}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </label>
                    {!internal && (
                      <p className="muted">
                        This records a reply already shared with the customer. It does not deliver
                        an email or chat message.
                      </p>
                    )}
                    <Button
                      variant="primary"
                      type="submit"
                      busy={busy}
                      style={{ justifySelf: 'end' }}
                    >
                      Add {internal ? 'internal note' : 'reply record'}
                    </Button>
                  </form>
                )}
              </div>
            </section>
          )}
        </div>
        <aside className="panel detail-side">
          <h2>People & next steps</h2>
          <p className="muted">Relationship owner</p>
          <div className="row">
            <span className="avatar">{owner?.name[0] ?? '?'}</span>
            <div>
              <strong>{owner?.name ?? 'Unassigned'}</strong>
              <p className="muted">{owner?.email}</p>
            </div>
          </div>
          {(row.contact || row.email || row.company) && (
            <div className="crm-person-card">
              {row.contact && (
                <Link className="link" href={`/app/crm/contacts/${row.contact.id}`}>
                  {row.contact.name} <ArrowRight size={14} />
                </Link>
              )}
              {row.email && (
                <a className="row" href={`mailto:${row.email}`}>
                  <Mail size={16} />
                  {row.email}
                </a>
              )}
              {row.phone && (
                <a className="row" href={`tel:${row.phone}`}>
                  <Phone size={16} />
                  {row.phone}
                </a>
              )}
              {row.company && (
                <p className="row">
                  <Building2 size={16} />
                  {row.company}
                </p>
              )}
            </div>
          )}
          {row.tags?.length ? (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {row.tags.map((t) => (
                <span className="badge" key={t}>
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {allowed && ['leads', 'deals', 'tickets'].includes(kind) && (
            <>
              <Button onClick={() => setAdd('tasks')}>
                <Plus size={16} />
                Create task
              </Button>
              <Button onClick={() => setAdd('activities')}>
                <Clock3 size={16} />
                Log activity
              </Button>
            </>
          )}
          {row.status === 'CONVERTED' && row.contactId && (
            <Link className="button primary" href={`/app/crm/contacts/${row.contactId}`}>
              Open contact <ArrowRight size={16} />
            </Link>
          )}
          {row.quoteId && (
            <Link className="button" href={`/app/sales/quotes/${row.quoteId}`}>
              Linked quote <Receipt size={16} />
            </Link>
          )}
          <div className="crm-disclosure">
            Customer records, follow-ups and documents stay linked in this workspace.
          </div>
        </aside>
      </div>
      {edit && <CrmDialog kind={kind} row={row} close={() => setEdit(false)} />}{' '}
      {add && <CrmDialog kind={add} close={() => setAdd(undefined)} defaults={defaults} />}
      <Modal
        open={convert}
        onOpenChange={setConvert}
        title="Turn this lead into a relationship"
        description="Create a contact and optionally an opportunity. Existing contacts with the same email are reused."
      >
        <form className="stack" onSubmit={convertLead}>
          {error && (
            <p className="form-alert" role="alert">
              {error}
            </p>
          )}
          <label className="row" style={{ display: 'flex' }}>
            <input
              type="checkbox"
              style={{ width: 18, minHeight: 18 }}
              checked={createDeal}
              onChange={(e) => setCreateDeal(e.target.checked)}
            />
            Create an opportunity
          </label>
          {createDeal && (
            <label>
              Start in stage
              <select
                required
                value={stageId || stages[0]?.id || ''}
                onChange={(e) => setStageId(e.target.value)}
              >
                {stages.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.pipeline} · {s.name}
                  </option>
                ))}
              </select>
              {!stages.length && (
                <p className="negative">
                  Create a pipeline first, or convert without an opportunity.
                </p>
              )}
            </label>
          )}
          <CustomInputs fields={contactFields} values={customValues} setValues={setCustomValues} />
          <div className="form-actions">
            <Button type="button" onClick={() => setConvert(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" busy={busy}>
              Convert lead
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
