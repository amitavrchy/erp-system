'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Archive, Trash2, Mail, Phone, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, money, date, errorMessage } from '@/lib/api';
import { modules, canWrite, documentHref } from '@/lib/modules';
import { useWorkspace } from '@/hooks/use-workspace';
import type { Entity } from '@/lib/types';
import { Button, Badge, Empty, Modal, Skeleton, ErrorState } from './ui';
import { CreateDialog } from './record-form';
import { ContactTimeline } from './contact-timeline';
import { StockAdjustment } from './stock-adjustment';
import { useRouter } from 'next/navigation';
import { useCrmMeta } from '@/hooks/use-crm';
import { humanize } from '@/lib/crm';

export function MasterDetail({ moduleKey, id }: { moduleKey: string; id: string }) {
  const c = modules[moduleKey];
  const { user, org, orgId } = useWorkspace();
  const cache = useQueryClient();
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const product = moduleKey === 'products';
  const crm = useCrmMeta(!product);
  const query = useQuery({
    queryKey: ['org', orgId, c.endpoint, id],
    queryFn: () =>
      api
        .get<Entity & { quotes?: Entity[]; salesOrders?: Entity[] }>(`/${c.endpoint}/${id}`)
        .then((r) => r.data),
    enabled: !!orgId,
  });
  if (query.isPending) return <Skeleton />;
  if (query.isError)
    return <ErrorState message={errorMessage(query.error)} retry={() => query.refetch()} />;
  const d = query.data;
  const allowed = user && canWrite(user.role, c.roles);
  const linked = [
    ...(d.quotes?.map((e) => ({ ...e, kind: 'quotes' })) ?? []),
    ...(d.salesOrders?.map((e) => ({ ...e, kind: 'sales-orders' })) ?? []),
    ...(d.invoices?.map((e) => ({ ...e, kind: 'invoices' })) ?? []),
  ];
  return (
    <>
      <Link
        className="row muted"
        style={{ marginBottom: 22 }}
        href={product ? '/app/inventory/products' : '/app/crm/contacts'}
      >
        <ArrowLeft size={16} />
        Back to {c.title.toLowerCase()}
      </Link>
      <div className="page-title spread">
        <div>
          <div className="row">
            <h1>{d.name}</h1>
            {product && d.isActive === false && <Badge status="ARCHIVED" />}
          </div>
          <p>{d.sku ?? d.title ?? d.email ?? 'All the details, connected.'}</p>
        </div>
        {allowed && (
          <div className="row">
            <Button onClick={() => setEdit(true)}>
              <Pencil size={16} />
              Edit {c.singular}
            </Button>
            {product && d.isActive !== false && (
              <Button variant="primary" onClick={() => setAdjust(true)}>
                <Plus size={16} />
                Adjust stock
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>{product ? 'Stock by warehouse' : 'Connected documents'}</h2>
          </div>
          {product ? (
            d.stockLevels?.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Warehouse</th>
                      <th scope="col">On hand</th>
                      <th scope="col">Value at cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.stockLevels.map((s, i) => (
                      <tr key={i}>
                        <td>{s.warehouse.name}</td>
                        <td className="mono">{s.quantity}</td>
                        <td className="mono">
                          {money(s.quantity * Number(d.costPrice), org?.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No stock recorded"
                description="Receive goods or add an opening stock adjustment."
              />
            )
          ) : linked.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Status</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {linked.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link href={documentHref(e.kind, e.id)} className="link mono">
                          {e.number}
                        </Link>
                      </td>
                      <td>
                        <Badge status={e.status} />
                      </td>
                      <td className="mono">{money(e.total, org?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="A relationship with room to grow"
              description="Quotes, orders and invoices for this customer will appear here."
            />
          )}
        </section>
        <aside className="panel detail-side">
          <h2>{product ? 'Product details' : 'Contact details'}</h2>
          {product ? (
            <>
              <div className="spread">
                <span className="muted">SKU</span>
                <span className="mono">{d.sku}</span>
              </div>
              <div className="spread">
                <span className="muted">Selling price</span>
                <span className="mono">{money(d.unitPrice, org?.currency)}</span>
              </div>
              <div className="spread">
                <span className="muted">Cost price</span>
                <span className="mono">{money(d.costPrice, org?.currency)}</span>
              </div>
              <div className="spread">
                <span className="muted">Reorder point</span>
                <span className="mono">{d.reorderPoint} units</span>
              </div>
              {d.attrsJson &&
                Object.entries(d.attrsJson).map(([k, v]) => (
                  <div className="spread" key={k}>
                    <span className="muted">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              {d.description && (
                <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                  {d.description}
                </p>
              )}
            </>
          ) : (
            <>
              {d.email && (
                <a className="row link" href={`mailto:${d.email}`}>
                  <Mail size={17} />
                  {d.email}
                </a>
              )}
              {d.phone && (
                <a className="row" href={`tel:${d.phone}`}>
                  <Phone size={17} />
                  {d.phone}
                </a>
              )}
              {d.company && (
                <div className="row">
                  <Building2 size={17} />
                  {d.company.name}
                </div>
              )}
              <p className="muted">Added {date(d.createdAt)}</p>
              <div className="spread">
                <span className="muted">Lifecycle</span>
                <Badge status={d.lifecycle ?? 'CUSTOMER'} />
              </div>
              <div className="spread">
                <span className="muted">Source</span>
                <span>{humanize(d.source ?? 'MANUAL')}</span>
              </div>
              <div className="spread">
                <span className="muted">Owner</span>
                <span>
                  {crm.data?.members.find((m) => m.id === d.ownerId)?.name ?? 'Unassigned'}
                </span>
              </div>
              {d.tags?.length ? (
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {d.tags.map((t) => (
                    <span className="badge" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              {Object.entries(d.customFields ?? {}).map(([key, value]) => (
                <div className="spread" key={key}>
                  <span className="muted">
                    {crm.data?.fields.find((f) => f.key === key && f.entity === 'contacts')?.name ??
                      key}
                  </span>
                  <span>{String(value ?? '—')}</span>
                </div>
              ))}
            </>
          )}
          {allowed && (
            <Button variant="danger" onClick={() => setRemove(true)}>
              {product ? <Archive size={16} /> : <Trash2 size={16} />}
              {product ? 'Archive product' : 'Delete contact'}
            </Button>
          )}
        </aside>
      </div>
      {!product && <ContactTimeline id={id} />}{' '}
      {edit && <CreateDialog moduleKey={moduleKey} record={d} open close={() => setEdit(false)} />}
      <Modal open={adjust} onOpenChange={setAdjust} title="Adjust stock">
        {adjust && <StockAdjustment productId={id} close={() => setAdjust(false)} />}
      </Modal>
      <Modal
        open={remove}
        onOpenChange={setRemove}
        title={product ? 'Archive this product?' : 'Delete this contact?'}
        description={
          product
            ? 'Existing documents and stock history will be kept.'
            : 'Contacts linked to documents cannot be deleted.'
        }
      >
        <div className="form-actions">
          <Button onClick={() => setRemove(false)}>Cancel</Button>
          <Button
            variant="danger"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.delete(`/${c.endpoint}/${id}`);
                await cache.invalidateQueries({ queryKey: ['org', orgId] });
                toast.success(product ? 'Product archived' : 'Contact deleted');
                router.push(product ? '/app/inventory/products' : '/app/crm/contacts');
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {product ? 'Archive' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
