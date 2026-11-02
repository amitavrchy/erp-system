'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { crmConfig, humanize, type CrmKind, type CrmRow, type CrmField } from '@/lib/crm';
import { useCrmMeta, useCrmList } from '@/hooks/use-crm';
import { useList, useWorkspace } from '@/hooks/use-workspace';
import { Button, Modal } from '@/components/ui';

type FormField = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
};
const commonOwner: FormField = { key: 'ownerId', label: 'Assigned to', type: 'owner' };
const commonContact: FormField = { key: 'contactId', label: 'Contact', type: 'contact' };
const notes: FormField = { key: 'notes', label: 'Notes', type: 'textarea' };
const config: Record<CrmKind, FormField[]> = {
  leads: [
    { key: 'name', label: 'Lead name', required: true },
    { key: 'company', label: 'Company' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'source',
      label: 'Source',
      type: 'select',
      options: ['WEBSITE', 'REFERRAL', 'EVENT', 'SOCIAL', 'OUTBOUND', 'PARTNER', 'OTHER'],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED'],
    },
    { key: 'score', label: 'Lead score', type: 'number', min: 0, max: 100 },
    { key: 'value', label: 'Potential value', type: 'money', min: 0 },
    commonOwner,
    { key: 'tags', label: 'Tags (comma separated)' },
    notes,
  ],
  deals: [
    { key: 'name', label: 'Deal name', required: true },
    { key: 'stageId', label: 'Pipeline stage', type: 'stage', required: true },
    commonContact,
    { key: 'leadId', label: 'Related lead', type: 'lead' },
    { key: 'value', label: 'Deal value', type: 'money', required: true, min: 0 },
    commonOwner,
    { key: 'expectedClose', label: 'Expected close', type: 'date' },
    { key: 'lostReason', label: 'Loss reason' },
    notes,
  ],
  tasks: [
    { key: 'name', label: 'Task title', required: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    },
    {
      key: 'type',
      label: 'Task type',
      type: 'select',
      options: ['FOLLOW_UP', 'CALL', 'EMAIL', 'MEETING', 'TODO'],
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      options: ['MEDIUM', 'LOW', 'HIGH', 'URGENT'],
    },
    commonOwner,
    { key: 'dueAt', label: 'Due at', type: 'datetime-local' },
    commonContact,
    { key: 'leadId', label: 'Related lead', type: 'lead' },
    { key: 'dealId', label: 'Related deal', type: 'deal' },
    notes,
  ],
  activities: [
    { key: 'name', label: 'Activity title', required: true },
    {
      key: 'type',
      label: 'Activity type',
      type: 'select',
      options: ['CALL', 'MEETING', 'EMAIL', 'NOTE'],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
    },
    commonOwner,
    { key: 'startsAt', label: 'Starts at', type: 'datetime-local', required: true },
    { key: 'endsAt', label: 'Ends at', type: 'datetime-local' },
    commonContact,
    { key: 'leadId', label: 'Related lead', type: 'lead' },
    { key: 'dealId', label: 'Related deal', type: 'deal' },
    { key: 'outcome', label: 'Outcome' },
    notes,
  ],
  campaigns: [
    { key: 'name', label: 'Campaign name', required: true },
    {
      key: 'channel',
      label: 'Channel',
      type: 'select',
      options: ['EMAIL', 'SMS', 'SOCIAL', 'EVENT', 'PHONE', 'OTHER'],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['DRAFT', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED'],
    },
    { key: 'segmentId', label: 'Audience segment', type: 'segment' },
    { key: 'budget', label: 'Budget', type: 'money', min: 0 },
    { key: 'spent', label: 'Actual spend', type: 'money', min: 0 },
    { key: 'startsAt', label: 'Starts on', type: 'date' },
    { key: 'endsAt', label: 'Ends on', type: 'date' },
    { key: 'subject', label: 'Message subject' },
    { key: 'body', label: 'Message draft', type: 'textarea' },
    notes,
  ],
  tickets: [
    { key: 'name', label: 'Ticket subject', required: true },
    commonContact,
    commonOwner,
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'],
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      options: ['MEDIUM', 'LOW', 'HIGH', 'URGENT'],
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: ['GENERAL', 'BILLING', 'PRODUCT', 'DELIVERY', 'TECHNICAL'],
    },
    {
      key: 'channel',
      label: 'Channel',
      type: 'select',
      options: ['EMAIL', 'PHONE', 'CHAT', 'WEB', 'OTHER'],
    },
    { key: 'dueAt', label: 'Resolution due', type: 'datetime-local' },
    notes,
    { key: 'resolution', label: 'Resolution', type: 'textarea' },
  ],
  segments: [
    { key: 'name', label: 'Segment name', required: true },
    {
      key: 'lifecycle',
      label: 'Contact lifecycle',
      type: 'select',
      options: ['', 'LEAD', 'PROSPECT', 'CUSTOMER', 'PARTNER', 'INACTIVE'],
    },
    { key: 'tag', label: 'Has tag' },
    { key: 'source', label: 'Acquisition source' },
    commonOwner,
  ],
  automations: [
    { key: 'name', label: 'Rule name', required: true },
    {
      key: 'trigger',
      label: 'When this happens',
      type: 'select',
      options: ['LEAD_CREATED', 'DEAL_STAGE_CHANGED', 'TICKET_CREATED'],
    },
    { key: 'taskTitle', label: 'Create follow-up task titled', required: true },
    { key: 'dueDays', label: 'Due in days', type: 'number', min: 0, max: 365 },
    commonOwner,
    { key: 'enabled', label: 'Rule enabled', type: 'checkbox' },
  ],
  fields: [
    { key: 'name', label: 'Field label', required: true },
    { key: 'key', label: 'Field key (lowercase, underscores)', required: true },
    { key: 'entity', label: 'Applies to', type: 'select', options: ['contacts', 'leads', 'deals'] },
    {
      key: 'type',
      label: 'Field type',
      type: 'select',
      options: ['TEXT', 'NUMBER', 'DATE', 'SELECT'],
    },
    { key: 'options', label: 'Select options (comma separated)' },
    { key: 'required', label: 'Required field', type: 'checkbox' },
  ],
};
export function CustomInputs({
  fields,
  values,
  setValues,
}: {
  fields: CrmField[];
  values: Record<string, string>;
  setValues: (v: Record<string, string>) => void;
}) {
  return (
    <>
      {fields.map((f) => (
        <label key={f.key}>
          {f.name}
          {f.required ? ' *' : ''}
          {f.type === 'SELECT' ? (
            <select
              required={f.required}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            >
              <option value="">Select…</option>
              {f.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              required={f.required}
              type={f.type === 'NUMBER' ? 'number' : f.type === 'DATE' ? 'date' : 'text'}
              maxLength={2000}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          )}
        </label>
      ))}
    </>
  );
}
export function CrmRecordForm({
  kind,
  row,
  close,
  defaults = {},
}: {
  kind: CrmKind;
  row?: CrmRow;
  close: () => void;
  defaults?: Record<string, string>;
}) {
  const { orgId, user } = useWorkspace();
  const cache = useQueryClient();
  const meta = useCrmMeta();
  const contacts = useList('contacts', { pageSize: 100 });
  const leads = useCrmList(
    'leads',
    { pageSize: 100 },
    ['deals', 'tasks', 'activities'].includes(kind),
  );
  const deals = useCrmList('deals', { pageSize: 100 }, ['tasks', 'activities'].includes(kind));
  const segments = useCrmList('segments', { pageSize: 100 }, kind === 'campaigns');
  const [error, setError] = useState('');
  const definitions = config[kind];
  const custom = meta.data?.fields.filter((f) => f.entity === kind) ?? [];
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(row?.customFields ?? {}).map(([k, v]) => [k, String(v ?? '')]),
    ),
  );
  const defaultValues: Record<string, string | boolean> = Object.fromEntries(
    definitions.map((f) => {
      const saved = row?.[f.key as keyof CrmRow];
      let value: string | boolean =
        f.type === 'checkbox'
          ? Boolean(saved ?? f.key === 'enabled')
          : saved === undefined || saved === null
            ? (defaults[f.key] ??
              (f.key === 'ownerId'
                ? kind === 'segments'
                  ? ''
                  : (user?.id ?? '')
                : (f.options?.[0] ?? (['money', 'number'].includes(f.type ?? '') ? '0' : ''))))
            : Array.isArray(saved)
              ? saved.join(', ')
              : String(saved);
      if (saved && f.type === 'datetime-local') {
        const d = new Date(String(saved));
        value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }
      if (saved && f.type === 'date') value = String(saved).slice(0, 10);
      return [f.key, value];
    }),
  );
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Record<string, string | boolean>>({ defaultValues });
  const lookup = (type: string) =>
    type === 'owner'
      ? meta.data?.members.map((m) => ({ id: m.id, name: m.name }))
      : type === 'contact'
        ? contacts.data?.data
        : type === 'stage'
          ? meta.data?.pipelines.flatMap((p) =>
              p.stages.map((s) => ({ id: s.id, name: `${p.name} · ${s.name}` })),
            )
          : type === 'lead'
            ? leads.data?.data
            : type === 'deal'
              ? deals.data?.data
              : segments.data?.data;
  async function submit(values: Record<string, string | boolean>) {
    setError('');
    const body: Record<string, unknown> = {};
    for (const f of definitions) {
      const v = values[f.key];
      if (f.type === 'checkbox') {
        body[f.key] = Boolean(v);
        continue;
      }
      const text = String(v ?? '').trim();
      if (!text) {
        if (f.required) {
          setError(`${f.label} is required`);
          return;
        }
        if (f.key === 'ownerId' || (f.key.endsWith('Id') && f.key !== 'stageId')) body[f.key] = '';
        continue;
      }
      if (f.type === 'number' || f.type === 'money') {
        const parsed = (f.type === 'number' ? z.coerce.number().int() : z.coerce.number())
          .min(f.min ?? 0)
          .max(f.max ?? 9999999999)
          .safeParse(v);
        if (!parsed.success) {
          setError(`Check ${f.label.toLowerCase()}`);
          return;
        }
        body[f.key] = parsed.data;
      } else if (['tags', 'options'].includes(f.key))
        body[f.key] = text
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      else if (f.type === 'date' || f.type === 'datetime-local')
        body[f.key] = new Date(text).toISOString();
      else body[f.key] = text;
    }
    if (custom.length)
      body.customFields = Object.fromEntries(
        custom.map((f) => [
          f.key,
          f.type === 'NUMBER' && customValues[f.key]
            ? Number(customValues[f.key])
            : (customValues[f.key] ?? ''),
        ]),
      );
    try {
      if (row) await api.patch(`/crm/${kind}/${row.id}`, body);
      else await api.post(`/crm/${kind}`, body);
      await cache.invalidateQueries({ queryKey: ['org', orgId] });
      toast.success(row ? 'Changes saved' : `${crmConfig[kind].singular} created`);
      close();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <form onSubmit={handleSubmit(submit)}>
      {error && (
        <div className="form-alert" role="alert" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}
      <div className="form-grid">
        {definitions.map((f) => (
          <label className={f.type === 'textarea' ? 'form-full' : ''} key={f.key}>
            {f.label}
            {f.required ? ' *' : ''}
            {f.type === 'textarea' ? (
              <textarea rows={3} maxLength={10000} {...register(f.key)} />
            ) : f.type === 'checkbox' ? (
              <input type="checkbox" style={{ width: 20, minHeight: 20 }} {...register(f.key)} />
            ) : f.type === 'select' ? (
              <select {...register(f.key)}>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o ? humanize(o) : 'Any lifecycle'}
                  </option>
                ))}
              </select>
            ) : ['owner', 'contact', 'stage', 'lead', 'deal', 'segment'].includes(f.type ?? '') ? (
              <select required={f.required} {...register(f.key)}>
                <option value="">{f.required ? 'Choose a stage' : 'Unassigned / none'}</option>
                {lookup(f.type!)?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required={f.required}
                type={f.type === 'money' || f.type === 'number' ? 'number' : (f.type ?? 'text')}
                step={f.type === 'money' ? '0.01' : f.type === 'number' ? '1' : undefined}
                min={f.min}
                max={f.max}
                maxLength={f.type === 'email' ? 200 : 160}
                {...register(f.key)}
              />
            )}
          </label>
        ))}
        <CustomInputs fields={custom} values={customValues} setValues={setCustomValues} />
      </div>
      {kind === 'automations' && (
        <p className="muted" style={{ marginTop: 18 }}>
          Use {'{{name}}'} in the task title. Enabled rules create a follow-up within the triggering
          transaction. Changes affect future events.
        </p>
      )}
      {kind === 'campaigns' && (
        <p className="muted" style={{ marginTop: 18 }}>
          This workspace plans campaigns and stores message drafts. External email/SMS delivery is
          not connected.
        </p>
      )}
      <div className="form-actions">
        <Button type="button" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={isSubmitting}>
          {row ? 'Save changes' : `Create ${crmConfig[kind].singular}`}
        </Button>
      </div>
    </form>
  );
}
export function CrmDialog({
  kind,
  row,
  close,
  defaults,
}: {
  kind: CrmKind;
  row?: CrmRow;
  close: () => void;
  defaults?: Record<string, string>;
}) {
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
      title={`${row ? 'Edit' : 'New'} ${crmConfig[kind].singular}`}
      description={crmConfig[kind].description}
      wide
    >
      <CrmRecordForm kind={kind} row={row} close={close} defaults={defaults} />
    </Modal>
  );
}
