'use client';
import { useState } from 'react';
import { flexRender } from '@tanstack/react-table';
import {
  useLegacyTable,
  getCoreRowModel,
  getSortedRowModel,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy';
import { ArrowUpDown } from 'lucide-react';
import type { Entity } from '@/lib/types';
export function DataTable({
  data,
  columns,
}: {
  data: Entity[];
  columns: LegacyColumnDef<Entity, unknown>[];
}) {
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([]);
  const table = useLegacyTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return (
    <div className="table-scroll">
      <table>
        <thead>
          {table.getHeaderGroups().map((h) => (
            <tr key={h.id}>
              {h.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  aria-sort={
                    header.column.getIsSorted() === 'asc'
                      ? 'ascending'
                      : header.column.getIsSorted() === 'desc'
                        ? 'descending'
                        : undefined
                  }
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <ArrowUpDown size={13} />
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
