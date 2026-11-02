'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Download,
  List,
  Columns3,
  ChevronLeft,
  ChevronRight,
  Pencil,
  CheckCircle2,
  Circle,
  GripVertical,
  ArrowUpRight,
} from 'lucide-react';
import type { LegacyColumnDef } from '@tanstack/react-table/legacy';
import { toast } from 'sonner';
import { api, errorMessage, money, date } from '@/lib/api';
import { crmConfig, humanize, type CrmKind, type CrmRow, type CrmStage } from '@/lib/crm';
import { canWrite } from '@/lib/modules';
import { exportRecords } from '@/lib/export';
import { useWorkspace } from '@/hooks/use-workspace';
import { useCrmList, useCrmMeta } from '@/hooks/use-crm';
import { DataTable } from '@/components/data-table';
import { Button, Badge, Empty, ErrorState, Skeleton, Modal } from '@/components/ui';
import { CrmDialog } from './crm-form';

export function CrmList({ kind }: { kind: CrmKind }) {
  const { orgId, org, user } = useWorkspace();
  const cache = useQueryClient();
  const meta = useCrmMeta();
  const sp = useSearchParams();
  const c = crmConfig[kind];
  const allowed = !!user && canWrite(user.role, c.admin ? [] : ['SALES']);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [owner, setOwner] = useState('');
  const [priority, setPriority] = useState('');
  const [overdue, setOverdue] = useState(sp.get('overdue') === 'true');
  const [board, setBoard] = useState(kind === 'deals');
  const [pipelineId, setPipelineId] = useState('');
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<CrmRow>();
  const [exporting, setExporting] = useState(false);
  const [moving, setMoving] = useState<{ row: CrmRow; stage: CrmStage }>();
  const [reason, setReason] = useState('');
  const [movingBusy, setMovingBusy] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(search);
      setPage(1);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);
  const pipeline = meta.data?.pipelines.find((p) => p.id === pipelineId) ?? meta.data?.pipelines[0];
  const pageSize = board ? 100 : 20;
  const params = {
    page,
    pageSize,
    q: term,
    ...(status ? { status } : {}),
    ...(owner ? { ownerId: owner } : {}),
    ...(priority ? { priority } : {}),
    ...(overdue ? { overdue: 'true' } : {}),
    ...(kind === 'deals' && pipeline ? { pipelineId: pipeline.id } : {}),
  };
  const query = useCrmList(kind, params);
  const rows = query.data?.data ?? [];
  const showCreate = form || sp.has('new');
  const [queryDismissed, setQueryDismissed] = useState(false);
  const close = () => {
    setForm(false);
    setEditing(undefined);
    setQueryDismissed(true);
  };
  const ownerName = (id?: string) =>
    meta.data?.members.find((m) => m.id === id)?.name ?? 'Unassigned';
  async function changeStage(row: CrmRow, stage: CrmStage, lostReason?: string) {
    if (row.stageId === stage.id) return;
    if (stage.outcome === 'LOST' && !lostReason) {
      setMoving({ row, stage });
      setReason('');
      return;
    }
    setMovingBusy(true);
    try {
      await api.post(`/crm/deals/${row.id}/move`, {
        stageId: stage.id,
        ...(lostReason ? { lostReason } : {}),
      });
      await cache.invalidateQueries({ queryKey: ['org', orgId] });
      toast.success(`Moved to ${stage.name}`);
      setMoving(undefined);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMovingBusy(false);
    }
  }
  async function toggleTask(row: CrmRow) {
    try {
      await api.patch(`/crm/tasks/${row.id}`, {
        status: row.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED',
      });
      await cache.invalidateQueries({ queryKey: ['org', orgId] });
      toast.success('Task updated');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  const columns: LegacyColumnDef<CrmRow, unknown>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header:
        kind === 'tickets'
          ? 'Ticket'
          : kind === 'tasks'
            ? 'Task'
            : kind === 'automations'
              ? 'Workflow'
              : 'Name',
      cell: ({ row }) => (
        <div className="row">
          {kind === 'tasks' && allowed && (
            <button
              className="crm-task-toggle"
              aria-label={`${row.original.status === 'COMPLETED' ? 'Reopen' : 'Complete'} ${row.original.name}`}
              onClick={() => toggleTask(row.original)}
            >
              {row.original.status === 'COMPLETED' ? (
                <CheckCircle2 size={20} />
              ) : (
                <Circle size={20} />
              )}
            </button>
          )}
          <div>
            {['leads', 'deals', 'tickets', 'campaigns', 'segments'].includes(kind) ? (
              <Link
                className="table-link cell-primary"
                href={`/app/crm/${kind}/${row.original.id}`}
              >
                {row.original.name}
              </Link>
            ) : (
              <span className="cell-primary">{row.original.name}</span>
            )}
            <span className="subtext">
              {row.original.number ??
                row.original.email ??
                row.original.contact?.name ??
                row.original.company ??
                row.original.key}
            </span>
          </div>
        </div>
      ),
    },
  ];
  if (c.statuses.length)
    columns.push({
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge status={row.original.status} />,
    });
  if (kind === 'leads')
    columns.push(
      { accessorKey: 'source', header: 'Source', cell: ({ row }) => humanize(row.original.source) },
      {
        accessorKey: 'score',
        header: 'Score',
        cell: ({ row }) => (
          <div className="crm-score">
            <span className="mono">{row.original.score ?? 0}</span>
            <div className="crm-progress">
              <span style={{ width: `${row.original.score ?? 0}%` }} />
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'value',
        header: 'Potential value',
        cell: ({ row }) => <span className="mono">{money(row.original.value, org?.currency)}</span>,
      },
    );
  if (kind === 'deals')
    columns.push(
      { id: 'stage', header: 'Stage', cell: ({ row }) => <span>{row.original.stage?.name}</span> },
      {
        accessorKey: 'value',
        header: 'Value',
        cell: ({ row }) => <span className="mono">{money(row.original.value, org?.currency)}</span>,
      },
      {
        accessorKey: 'expectedClose',
        header: 'Expected close',
        cell: ({ row }) => date(row.original.expectedClose),
      },
    );
  if (['tasks', 'tickets'].includes(kind))
    columns.push(
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => (
          <span className={`crm-priority ${(row.original.priority ?? '').toLowerCase()}`}>
            {humanize(row.original.priority)}
          </span>
        ),
      },
      {
        accessorKey: 'dueAt',
        header: 'Due',
        cell: ({ row }) => (
          <span
            className={
              row.original.dueAt &&
              new Date(row.original.dueAt) < new Date() &&
              !['COMPLETED', 'RESOLVED', 'CLOSED', 'CANCELLED'].includes(row.original.status ?? '')
                ? 'negative'
                : ''
            }
          >
            {date(row.original.dueAt)}
          </span>
        ),
      },
    );
  if (kind === 'activities')
    columns.push(
      { accessorKey: 'type', header: 'Type', cell: ({ row }) => humanize(row.original.type) },
      {
        accessorKey: 'startsAt',
        header: 'When',
        cell: ({ row }) => (
          <span>
            {date(row.original.startsAt)}
            <span className="subtext">
              {row.original.startsAt
                ? new Date(row.original.startsAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''}
            </span>
          </span>
        ),
      },
    );
  if (kind === 'campaigns')
    columns.push(
      { accessorKey: 'channel', header: 'Channel' },
      {
        id: 'audience',
        header: 'Audience',
        cell: ({ row }) => row.original.segment?.name ?? 'Not selected',
      },
      {
        accessorKey: 'budget',
        header: 'Budget',
        cell: ({ row }) => money(row.original.budget, org?.currency),
      },
      {
        accessorKey: 'spent',
        header: 'Spent',
        cell: ({ row }) => money(row.original.spent, org?.currency),
      },
    );
  if (kind === 'segments')
    columns.push(
      {
        accessorKey: 'lifecycle',
        header: 'Lifecycle',
        cell: ({ row }) => humanize(row.original.lifecycle),
      },
      { accessorKey: 'tag', header: 'Tag', cell: ({ row }) => row.original.tag ?? 'Any tag' },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => row.original.source ?? 'Any source',
      },
    );
  if (kind === 'automations')
    columns.push(
      {
        accessorKey: 'trigger',
        header: 'Trigger',
        cell: ({ row }) => humanize(row.original.trigger),
      },
      {
        accessorKey: 'enabled',
        header: 'Status',
        cell: ({ row }) => <Badge status={row.original.enabled ? 'ACTIVE' : 'PAUSED'} />,
      },
      {
        accessorKey: 'runCount',
        header: 'Executions',
        cell: ({ row }) => <span className="mono">{row.original.runCount ?? 0}</span>,
      },
    );
  if (kind === 'fields')
    columns.push(
      { accessorKey: 'entity', header: 'Entity' },
      { accessorKey: 'type', header: 'Type' },
      {
        accessorKey: 'required',
        header: 'Required',
        cell: ({ row }) => (row.original.required ? 'Required' : 'Optional'),
      },
    );
  if (['leads', 'deals', 'tasks', 'activities', 'tickets'].includes(kind))
    columns.push({
      id: 'owner',
      header: 'Owner',
      accessorFn: (r) => ownerName(r.ownerId),
      cell: ({ row }) => (
        <div className="row">
          <span className="crm-owner-dot">{ownerName(row.original.ownerId)[0]}</span>
          {ownerName(row.original.ownerId)}
        </div>
      ),
    });
  if (allowed)
    columns.push({
      id: 'edit',
      header: '',
      enableSorting: false,
      cell: ({ row }) =>
        !(kind === 'leads' && row.original.status === 'CONVERTED') && (
          <Button
            variant="ghost"
            aria-label={`Edit ${row.original.name}`}
            onClick={() => {
              setEditing(row.original);
              setForm(true);
            }}
          >
            <Pencil size={16} />
          </Button>
        ),
    });
  return (
    <>
      <div className="page-title spread">
        <div>
          <h1>{c.title}</h1>
          <p>{c.description}</p>
        </div>
        <div className="row">
          {kind === 'activities' && (
            <Link className="button" href="/app/crm/calendar">
              Open calendar
            </Link>
          )}
          <Button
            busy={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const count = await exportRecords(`crm/${kind}`, params);
                toast.success(count ? `Exported ${count} records` : 'No matching records');
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download size={16} />
            Export
          </Button>
          {allowed && (
            <Button
              variant="primary"
              onClick={() => {
                setEditing(undefined);
                setForm(true);
              }}
            >
              <Plus size={17} />
              New {c.singular}
            </Button>
          )}
        </div>
      </div>
      {['campaigns', 'segments'].includes(kind) && (
        <div className="module-tabs">
          <Link className={kind === 'campaigns' ? 'active' : ''} href="/app/crm/campaigns">
            Campaigns
          </Link>
          <Link className={kind === 'segments' ? 'active' : ''} href="/app/crm/segments">
            Audience segments
          </Link>
        </div>
      )}
      {['automations', 'fields'].includes(kind) && (
        <div className="module-tabs">
          <Link href="/app/crm/pipelines">Pipelines</Link>
          <Link className={kind === 'automations' ? 'active' : ''} href="/app/crm/automations">
            Automations
          </Link>
          <Link className={kind === 'fields' ? 'active' : ''} href="/app/crm/fields">
            Custom fields
          </Link>
          <Link href="/app/crm/import">Import contacts</Link>
        </div>
      )}
      <section className={board ? 'crm-board-container' : 'panel'}>
        <div className="toolbar">
          <div className="crm-filters">
            <div className="filter-search">
              <Search size={16} />
              <input
                aria-label={`Search ${kind}`}
                placeholder={`Search ${kind}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {kind === 'deals' && (
              <select
                aria-label="Pipeline"
                value={pipeline?.id ?? ''}
                onChange={(e) => {
                  setPipelineId(e.target.value);
                  setPage(1);
                }}
              >
                {meta.data?.pipelines.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            {c.statuses.length > 0 && (
              <select
                aria-label="Status filter"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {c.statuses.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </select>
            )}
            {['leads', 'deals', 'tasks', 'activities', 'tickets'].includes(kind) && (
              <select
                aria-label="Owner filter"
                value={owner}
                onChange={(e) => {
                  setOwner(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All owners</option>
                <option value="me">Assigned to me</option>
                {meta.data?.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            {['tasks', 'tickets'].includes(kind) && (
              <>
                <select
                  aria-label="Priority filter"
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All priorities</option>
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                    <option value={p} key={p}>
                      {humanize(p)}
                    </option>
                  ))}
                </select>
                <Button
                  variant={overdue ? 'primary' : 'default'}
                  onClick={() => {
                    setOverdue(!overdue);
                    setPage(1);
                  }}
                >
                  Overdue
                </Button>
              </>
            )}
          </div>
          {kind === 'deals' && (
            <div className="segmented">
              <button
                aria-label="Board view"
                className={board ? 'active' : ''}
                onClick={() => {
                  setBoard(true);
                  setPage(1);
                }}
              >
                <Columns3 size={17} />
              </button>
              <button
                aria-label="List view"
                className={!board ? 'active' : ''}
                onClick={() => {
                  setBoard(false);
                  setPage(1);
                }}
              >
                <List size={17} />
              </button>
            </div>
          )}
        </div>
        {query.isPending ? (
          <Skeleton />
        ) : query.isError ? (
          <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} />
        ) : board ? (
          pipeline ? (
            <div className="crm-board">
              {pipeline.stages.map((stage) => {
                const items = rows.filter((d) => d.stageId === stage.id);
                return (
                  <div
                    key={stage.id}
                    className={`crm-board-column ${stage.outcome.toLowerCase()}`}
                    onDragOver={(e) => {
                      if (allowed) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!allowed) return;
                      const row = rows.find((r) => r.id === e.dataTransfer.getData('text/plain'));
                      if (row) changeStage(row, stage);
                    }}
                  >
                    <div className="crm-column-heading spread">
                      <div className="row">
                        <span className={`crm-stage-dot ${stage.outcome.toLowerCase()}`} />
                        <h3>{stage.name}</h3>
                        <span className="muted">{items.length}</span>
                      </div>
                      <span className="muted">{stage.probability}%</span>
                    </div>
                    <p className="crm-column-total mono">
                      {money(
                        items.reduce((n, d) => n + Number(d.value), 0),
                        org?.currency,
                      )}
                    </p>
                    <div className="crm-column-cards">
                      {items.map((d) => (
                        <article
                          key={d.id}
                          className="crm-deal-card"
                          draggable={allowed}
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', d.id)}
                        >
                          <div className="spread">
                            <span className="mono muted">{d.number}</span>
                            {allowed && <GripVertical size={16} className="muted" />}
                          </div>
                          <Link href={`/app/crm/deals/${d.id}`} className="crm-deal-name">
                            {d.name}
                          </Link>
                          <p className="muted">
                            {d.contact?.name ?? d.lead?.company ?? 'No contact selected'}
                          </p>
                          <div className="spread" style={{ margin: '16px 0' }}>
                            <strong className="mono">{money(d.value, org?.currency)}</strong>
                            <span className="crm-owner-dot" title={ownerName(d.ownerId)}>
                              {ownerName(d.ownerId)[0]}
                            </span>
                          </div>
                          <div className="crm-card-footer">
                            <span className="muted">{date(d.expectedClose)}</span>
                            {allowed && (
                              <select
                                disabled={movingBusy}
                                aria-label={`Move ${d.name}`}
                                value={d.stageId}
                                onChange={(e) => {
                                  const s = pipeline.stages.find((s) => s.id === e.target.value);
                                  if (s) changeStage(d, s);
                                }}
                              >
                                {pipeline.stages.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </article>
                      ))}
                      {!items.length && (
                        <div className="crm-column-empty">
                          {allowed ? 'Drop a deal here' : 'No opportunities'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              title="A pipeline shaped around your team"
              description="Create your stages, then add your first opportunity."
              action={
                <Link href="/app/crm/pipelines" className="button primary">
                  Set up a pipeline <ArrowUpRight size={16} />
                </Link>
              }
            />
          )
        ) : !rows.length ? (
          <Empty
            title={`No ${kind} to show`}
            description="Create a record, or try changing your filters."
          />
        ) : (
          <DataTable data={rows} columns={columns} />
        )}
        <div className="table-footer">
          <span>
            {query.data?.meta.total ?? 0} {kind}
            {board ? ' · Drag a card or use its stage selector' : ''}
          </span>
          <div className="row">
            <span>
              Page {page} of {Math.max(1, Math.ceil((query.data?.meta.total ?? 0) / pageSize))}
            </span>
            <Button
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              aria-label="Next page"
              disabled={!query.data || page * pageSize >= query.data.meta.total}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>
      {(form || (showCreate && !queryDismissed)) && allowed && (
        <CrmDialog
          kind={kind}
          row={editing}
          close={close}
          defaults={
            kind === 'deals'
              ? { stageId: pipeline?.stages.find((s) => s.outcome === 'OPEN')?.id ?? '' }
              : undefined
          }
        />
      )}
      <Modal
        open={!!moving}
        onOpenChange={(v) => {
          if (!v) setMoving(undefined);
        }}
        title="What changed?"
        description="Record a reason before marking this opportunity as lost."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (moving) changeStage(moving.row, moving.stage, reason);
          }}
        >
          <label>
            Loss reason
            <textarea
              required
              minLength={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <Button type="button" onClick={() => setMoving(undefined)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" busy={movingBusy}>
              Mark as lost
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
