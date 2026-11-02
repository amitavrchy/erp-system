import { api } from './api';
import type { PageData, Entity } from './types';
export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  const csv =
    '\uFEFF' +
    [
      headers.map(cell).join(','),
      ...rows.map((r) => headers.map((k) => cell(r[k])).join(',')),
    ].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportRecords(endpoint: string, params: Record<string, string | number>) {
  const all: Entity[] = [];
  let page = 1;
  let total = 1;
  while (all.length < total) {
    const r = await api.get<PageData>(`/${endpoint}`, {
      params: { ...params, page, pageSize: 100 },
    });
    all.push(...r.data.data);
    total = r.data.meta.total;
    if (!r.data.data.length) break;
    page++;
  }
  const simple = all.map((e) =>
    Object.fromEntries(
      Object.entries(e).filter(
        ([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v),
      ),
    ),
  );
  downloadCsv(endpoint.replaceAll('/', '-'), simple);
  return all.length;
}
