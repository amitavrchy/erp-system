'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  Workflow,
  ShieldCheck,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCrmMeta } from '@/hooks/use-crm';
import { useWorkspace } from '@/hooks/use-workspace';
import { api, errorMessage } from '@/lib/api';
import { humanize, type CrmPipeline } from '@/lib/crm';
import { canWrite } from '@/lib/modules';
import { Button, Modal, Skeleton, ErrorState, Empty } from '@/components/ui';

function PipelineForm({ pipeline, close }: { pipeline?: CrmPipeline; close: () => void }) {
  const { orgId } = useWorkspace();
  const cache = useQueryClient();
  const [name, setName] = useState(pipeline?.name ?? 'Sales pipeline');
  const [stages, setStages] = useState<
    { id?: string; name: string; probability: number; outcome: string }[]
  >(
    pipeline?.stages.map((s) => ({
      id: s.id,
      name: s.name,
      probability: s.probability,
      outcome: s.outcome,
    })) ?? [
      { name: 'Discovery', probability: 10, outcome: 'OPEN' },
      { name: 'Qualified', probability: 30, outcome: 'OPEN' },
      { name: 'Proposal', probability: 60, outcome: 'OPEN' },
      { name: 'Negotiation', probability: 80, outcome: 'OPEN' },
      { name: 'Won', probability: 100, outcome: 'WON' },
      { name: 'Lost', probability: 0, outcome: 'LOST' },
    ],
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function move(i: number, offset: number) {
    const next = [...stages];
    [next[i], next[i + offset]] = [next[i + offset], next[i]];
    setStages(next);
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          if (pipeline) await api.patch(`/crm/pipelines/${pipeline.id}`, { name, stages });
          else await api.post('/crm/pipelines', { name, stages });
          await cache.invalidateQueries({ queryKey: ['org', orgId] });
          toast.success('Pipeline saved');
          close();
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      <label>
        Pipeline name
        <input
          required
          minLength={2}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="crm-stage-editor table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Stage name</th>
              <th scope="col">Probability %</th>
              <th scope="col">Outcome</th>
              <th scope="col">Order</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s, i) => (
              <tr key={i}>
                <td>
                  <input
                    aria-label={`Stage ${i + 1} name`}
                    required
                    minLength={2}
                    maxLength={80}
                    value={s.name}
                    onChange={(e) =>
                      setStages(
                        stages.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`Stage ${i + 1} probability`}
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={s.probability}
                    onChange={(e) =>
                      setStages(
                        stages.map((s, j) =>
                          j === i ? { ...s, probability: Number(e.target.value) } : s,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <select
                    aria-label={`Stage ${i + 1} outcome`}
                    value={s.outcome}
                    onChange={(e) =>
                      setStages(
                        stages.map((s, j) => (j === i ? { ...s, outcome: e.target.value } : s)),
                      )
                    }
                  >
                    {['OPEN', 'WON', 'LOST'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="row">
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Move stage ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp size={15} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Move stage ${i + 1} down`}
                      disabled={i === stages.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={15} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove stage ${i + 1}`}
                      disabled={stages.length <= 3}
                      onClick={() => setStages(stages.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="ghost"
        disabled={stages.length >= 12}
        onClick={() =>
          setStages([...stages, { name: 'New stage', probability: 50, outcome: 'OPEN' }])
        }
      >
        <Plus size={16} />
        Add stage
      </Button>
      <p className="muted" style={{ marginTop: 16 }}>
        Keep at least one open, won and lost stage. Stages holding deals cannot be removed or change
        their outcome.
      </p>
      <div className="form-actions">
        <Button type="button" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={busy}>
          Save pipeline
        </Button>
      </div>
    </form>
  );
}
export function CrmPipelines() {
  const meta = useCrmMeta();
  const { user } = useWorkspace();
  const admin = user && canWrite(user.role, []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmPipeline>();
  return (
    <>
      <div className="page-title spread">
        <div>
          <h1>A CRM shaped around your team.</h1>
          <p>Define your process, capture your context and automate the next step.</p>
        </div>
        {admin && (
          <Button
            variant="primary"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus size={17} />
            New pipeline
          </Button>
        )}
      </div>
      <div className="module-tabs">
        <Link className="active" href="/app/crm/pipelines">
          Pipelines
        </Link>
        <Link href="/app/crm/automations">Automations</Link>
        <Link href="/app/crm/fields">Custom fields</Link>
        <Link href="/app/crm/import">Import contacts</Link>
      </div>
      {meta.isPending ? (
        <Skeleton />
      ) : meta.isError ? (
        <ErrorState message={errorMessage(meta.error)} retry={() => meta.refetch()} />
      ) : meta.data.pipelines.length ? (
        <div className="stack">
          {meta.data.pipelines.map((p) => (
            <section className="panel" key={p.id}>
              <div className="panel-heading spread">
                <div className="row">
                  <span className="crm-stat-icon blue">
                    <Workflow size={21} />
                  </span>
                  <div>
                    <h2>{p.name}</h2>
                    <p className="muted">
                      {p.stages.length} stages · probability-weighted forecasting
                    </p>
                  </div>
                </div>
                {admin && (
                  <Button
                    onClick={() => {
                      setEditing(p);
                      setOpen(true);
                    }}
                  >
                    <Pencil size={16} />
                    Configure
                  </Button>
                )}
              </div>
              <div className="panel-body crm-pipeline-preview">
                {p.stages.map((s) => (
                  <div key={s.id}>
                    <span className={`crm-stage-dot ${s.outcome.toLowerCase()}`} />
                    <strong>{s.name}</strong>
                    <p className="muted">
                      {s.probability}% · {humanize(s.outcome)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty
          title="Start with your sales process"
          description="Create a pipeline with discovery, qualification, proposal and closing stages."
        />
      )}
      <div className="crm-admin-shortcuts">
        <Link className="panel" href="/app/crm/automations">
          <Workflow size={23} />
          <h3>Automate the follow-up</h3>
          <p className="muted">
            Create tasks when leads arrive, deals move or support requests open.
          </p>
        </Link>
        <Link className="panel" href="/app/crm/fields">
          <ShieldCheck size={23} />
          <h3>Capture your own context</h3>
          <p className="muted">Add text, number, date and selection fields to customer records.</p>
        </Link>
        <Link className="panel" href="/app/crm/import">
          <Upload size={23} />
          <h3>Bring your relationships</h3>
          <p className="muted">
            Preview a CSV and import contacts with duplicate email protection.
          </p>
        </Link>
      </div>
      {open && (
        <Modal
          open
          onOpenChange={setOpen}
          title={editing ? 'Configure pipeline' : 'Create pipeline'}
          wide
        >
          <PipelineForm pipeline={editing} close={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (quoted) throw new Error('Unclosed quote in CSV');
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}
export function CrmImport() {
  const { orgId, user } = useWorkspace();
  const cache = useQueryClient();
  const [rows, setRows] = useState<{ name: string; email?: string; phone?: string }[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number }>();
  const allowed = user && canWrite(user.role, ['SALES']);
  return (
    <>
      <div className="page-title">
        <h1>Bring your relationships with you.</h1>
        <p>Preview your CSV, then import contacts into this workspace.</p>
      </div>
      <div className="module-tabs">
        <Link href="/app/crm/pipelines">Pipelines</Link>
        <Link href="/app/crm/automations">Automations</Link>
        <Link href="/app/crm/fields">Custom fields</Link>
        <Link className="active" href="/app/crm/import">
          Import contacts
        </Link>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Import contacts</h2>
          <p className="muted">
            UTF-8 CSV · required header: name · optional: email, phone · up to 500 contacts
          </p>
        </div>
        <div className="panel-body stack">
          {error && (
            <div className="form-alert" role="alert">
              {error}
            </div>
          )}
          {result ? (
            <div className="row positive">
              <CheckCircle2 size={22} />
              {result.created} contacts imported. {result.skipped} duplicate emails skipped.
            </div>
          ) : (
            <>
              <label>
                Choose a CSV file
                <input
                  disabled={!allowed}
                  aria-label="Contacts CSV file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    setError('');
                    setRows([]);
                    try {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 250000) throw new Error('Use a CSV smaller than 250 KB');
                      const parsed = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
                      const headers = parsed.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
                      if (!headers.includes('name')) throw new Error('The CSV needs a name header');
                      if (parsed.length > 500)
                        throw new Error('Import at most 500 contacts at a time');
                      if (!parsed.length) throw new Error('No contact rows found');
                      const records = parsed.map((cells, i) => {
                        const name = cells[headers.indexOf('name')]?.trim() ?? '';
                        if (name.length < 2) throw new Error(`Row ${i + 2} needs a contact name`);
                        const email = cells[headers.indexOf('email')]?.trim();
                        const phone = cells[headers.indexOf('phone')]?.trim();
                        return { name, ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
                      });
                      setRows(records);
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                  }}
                />
              </label>
              <p className="muted">
                Contacts with matching emails are skipped within this organization. Imported records
                are marked as prospects with source Import. Existing contacts are preserved.
              </p>
            </>
          )}
        </div>
        {rows.length > 0 && !result && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.email ?? '—'}</td>
                      <td>{r.phone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-body spread">
              <p className="muted">{rows.length} contacts ready · showing first 10</p>
              <Button
                variant="primary"
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    const r = await api.post<{ created: number; skipped: number }>(
                      '/crm/contacts/import',
                      { rows },
                    );
                    setResult(r.data);
                    await cache.invalidateQueries({ queryKey: ['org', orgId] });
                    toast.success('Import complete');
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Import {rows.length} contacts
              </Button>
            </div>
          </>
        )}
        {result && (
          <div className="panel-body row">
            <Link href="/app/crm/contacts" className="button primary">
              View contacts
            </Link>
            <Button
              onClick={() => {
                setRows([]);
                setResult(undefined);
              }}
            >
              Import another file
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
