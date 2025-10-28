'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GripVertical, Pencil, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

export interface FixtureRow {
  id: number;
  backendId?: string;
  sidebarId?: number;
  type: string;
  modelName?: string;
  sizeIn?: string | number;
  manufacturer?: string;
  price?: number;
  lumens?: number;
  peakPowerW?: number;
  maxVoltageV?: number;
  maxCurrentA?: number;
  minPwm?: number;
  maxPwm?: number;
  dimmingMode?: string;
  dimmingCurve?: string;
  minCct?: number;
  midCct?: number;
  maxCct?: number;
  channelCount?: number;
  dimmingGamma?: number;
}

interface Props {
  data: FixtureRow[];
  onAdd: () => void;
  onEdit: (row: FixtureRow) => void;
  onDelete?: (row: FixtureRow) => void;
  isLoading?: boolean;
}

type Align = 'left' | 'right' | 'center';

type ColumnDef<T> = {
  id: string;
  header: string;
  align?: Align;
  render: (row: T) => React.ReactNode;
};

const currencyOrNA = (n?: number) =>
  typeof n === 'number' ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'NA';
const numberOrNA = (n?: number) => (typeof n === 'number' ? n.toLocaleString() : 'NA');
const textOrNA = (v?: string | number) =>
  v !== undefined && v !== null && `${v}`.trim() !== '' ? `${v}` : 'NA';

const storageKey = 'fixtureTableColumns';

const defaultColumns: ColumnDef<FixtureRow>[] = [
  {
    id: 'id',
    header: 'Fixture ID',
    align: 'left',
    render: r => <span className="font-medium text-muted-foreground/90">{r.id}</span>,
  },
  { id: 'type', header: 'Fixture Type', align: 'left', render: r => r.type },
  { id: 'modelName', header: 'Model Name', align: 'left', render: r => textOrNA(r.modelName) },
  { id: 'sizeIn', header: 'Size (IN.)', align: 'right', render: r => textOrNA(r.sizeIn) },
  {
    id: 'manufacturer',
    header: 'Manufacturer',
    align: 'left',
    render: r => textOrNA(r.manufacturer),
  },
  { id: 'price', header: 'Price', align: 'right', render: r => currencyOrNA(r.price) },
  { id: 'lumens', header: 'Lumens', align: 'right', render: r => numberOrNA(r.lumens) },
  {
    id: 'peakPowerW',
    header: 'Peak Power (W)',
    align: 'right',
    render: r => numberOrNA(r.peakPowerW),
  },
  {
    id: 'maxVoltageV',
    header: 'Max Voltage (V)',
    align: 'right',
    render: r => numberOrNA(r.maxVoltageV),
  },
  {
    id: 'maxCurrentA',
    header: 'Max Current (A)',
    align: 'right',
    render: r => numberOrNA(r.maxCurrentA),
  },
  { id: 'minPwm', header: 'Min PWM', align: 'right', render: r => numberOrNA(r.minPwm) },
  { id: 'maxPwm', header: 'Max PWM', align: 'right', render: r => numberOrNA(r.maxPwm) },
  {
    id: 'dimmingMode',
    header: 'Dimming Mode',
    align: 'left',
    render: r => textOrNA(r.dimmingMode),
  },
  // {
  //   id: 'dimmingCurve',
  //   header: 'Dimming Curve',
  //   align: 'left',
  //   render: r => textOrNA(r.dimmingCurve),
  // },
  {
    id: 'dimmingGamma',
    header: 'Dimming Gamma',
    align: 'right',
    render: r => numberOrNA(r.dimmingGamma),
  },
  {
    id: 'channelCount',
    header: 'Channels',
    align: 'right',
    render: r => numberOrNA(r.channelCount),
  },
  {
    id: 'minCct',
    header: 'Min CCT',
    align: 'right',
    render: r =>
      typeof r.minCct === 'number' ? (
        <span className="font-medium">{numberOrNA(r.minCct)}</span>
      ) : (
        <span className="text-muted-foreground/70">NA</span>
      ),
  },
  { id: 'midCct', header: 'Mid CCT (if 3-Ch)', align: 'right', render: r => numberOrNA(r.midCct) },
  { id: 'maxCct', header: 'Max CCT', align: 'right', render: r => numberOrNA(r.maxCct) },
];

function orderColumns(cols: ColumnDef<FixtureRow>[], savedIds?: string[]) {
  if (!savedIds || savedIds.length === 0) return cols;
  const byId = new Map(cols.map(c => [c.id, c] as const));
  const inOrder: ColumnDef<FixtureRow>[] = [];
  for (const id of savedIds) {
    const c = byId.get(id);
    if (c) {
      inOrder.push(c);
      byId.delete(id);
    }
  }
  byId.forEach(c => inOrder.push(c));
  return inOrder;
}

export default function FixtureLibraryTable({
  data,
  onAdd,
  onEdit,
  onDelete,
  isLoading = false,
}: Props) {
  const [columns, setColumns] = useState<ColumnDef<FixtureRow>[]>(defaultColumns);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [loadingOrder, setLoadingOrder] = useState<boolean>(true);
  // Pagination state
  const pageSize = 8;
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const ids = JSON.parse(saved) as string[];
          setColumns(orderColumns(defaultColumns, ids));
        } catch {}
      }
    }
    setLoadingOrder(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || loadingOrder) return;
    const ids = columns.map(c => c.id);
    localStorage.setItem(storageKey, JSON.stringify(ids));
  }, [columns, loadingOrder]);

  // Clamp current page when data changes
  const totalPages = Math.max(1, Math.ceil((data?.length || 0) / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
    if (currentPage < 1) setCurrentPage(1);
  }, [currentPage, totalPages]);

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;

  // Sort data by sequential ID, then slice for pagination
  const sortedData = [...data].sort((a, b) => a.id - b.id);
  const pageRows = sortedData.slice(startIdx, endIdx);

  const alignClass = (a?: Align) =>
    a === 'right' ? 'text-center' : a === 'center' ? 'text-center' : 'text-center';

  const onDragStart = (id: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  };
  const onDragLeave = () => setDragOverId(null);
  const onDrop = (targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;
    setColumns(prev => {
      const srcIdx = prev.findIndex(c => c.id === sourceId);
      const tgtIdx = prev.findIndex(c => c.id === targetId);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, moved);
      return next;
    });
  };

  return (
    <Card className="p-6 border border-border/60 shadow-sm bg-gradient-to-br from-card to-muted/30">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-medium tracking-wide text-muted-foreground">
            Fixture Library Manager
          </h2>
          <p className="text-muted-foreground/80 text-xs">
            Manage your fixture specifications and configurations
          </p>
        </div>
        <Button onClick={onAdd} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Fixture
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/60" aria-busy={loadingOrder}>
        <Table className="min-w-[900px]">
          <TableHeader className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-background/70 bg-background/90">
            <TableRow className="bg-gradient-to-r from-accent/60 to-transparent">
              {(loadingOrder ? defaultColumns : columns).map(col => (
                <TableHead
                  key={col.id}
                  draggable={!loadingOrder}
                  onDragStart={!loadingOrder ? onDragStart(col.id) : undefined}
                  onDragOver={!loadingOrder ? onDragOver(col.id) : undefined}
                  onDragLeave={!loadingOrder ? onDragLeave : undefined}
                  onDrop={!loadingOrder ? onDrop(col.id) : undefined}
                  className={`${alignClass(col.align)} text-xs uppercase tracking-wider text-muted-foreground/80 py-3 ${loadingOrder ? '' : 'select-none cursor-grab active:cursor-grabbing relative'} ${!loadingOrder && dragOverId === col.id ? 'ring-1 ring-primary' : ''}`}
                  aria-grabbed={!loadingOrder && dragOverId === col.id}
                >
                  {loadingOrder ? (
                    <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                  ) : (
                    <span className="group inline-flex items-center gap-2">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground/80" />
                      {col.header}
                    </span>
                  )}
                </TableHead>
              ))}
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground/80 py-3 text-right">
                {loadingOrder ? (
                  <div className="h-3 w-16 rounded bg-muted animate-pulse ml-auto" />
                ) : (
                  'Actions'
                )}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingOrder || isLoading ? (
              Array.from({ length: Math.max(3, Math.min(6, data.length || 5)) }).map((_, idx) => (
                <TableRow
                  key={`skeleton-${idx}`}
                  className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                >
                  {defaultColumns.map(col => (
                    <TableCell key={`sk-${col.id}-${idx}`} className={`${alignClass(col.align)}`}>
                      <div
                        className={`h-3 ${col.align === 'right' ? 'ml-auto' : col.align === 'center' ? 'mx-auto' : ''} w-20 rounded bg-muted animate-pulse`}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2 justify-end">
                      <div className="h-6 w-6 rounded bg-muted animate-pulse" />
                      <div className="h-6 w-6 rounded bg-muted animate-pulse" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
                  No fixtures yet. Use the Add Fixture button to create your first one.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, idx) => (
                <TableRow key={row.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                  {columns.map(col => (
                    <TableCell
                      key={col.id}
                      className={`${alignClass(col.align)} ${col.align === 'right' ? 'tabular-nums' : ''}`}
                    >
                      {col.render(row)}
                    </TableCell>
                  ))}
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(row)}
                      aria-label={`Edit ${row.modelName ?? row.type}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(row)}
                        aria-label={`Delete ${row.modelName ?? row.type}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {/* Pagination controls */}
      {!isLoading && data.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{startIdx + 1}</span> to{' '}
            <span className="font-medium text-foreground">{Math.min(endIdx, data.length)}</span> of{' '}
            <span className="font-medium text-foreground">{data.length}</span> fixtures
          </div>
          <div className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40 shadow-sm px-1 py-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 rounded-lg hover:bg-primary/10"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }).map((_, i) => {
              const page = i + 1;
              // Show compact window with ellipsis
              const show =
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1);
              if (!show) {
                // Insert ellipsis boundaries
                if (page === 2 && currentPage > 3) {
                  return (
                    <span key="ellipsis-left" className="px-2 text-muted-foreground/70">
                      …
                    </span>
                  );
                }
                if (page === totalPages - 1 && currentPage < totalPages - 2) {
                  return (
                    <span key="ellipsis-right" className="px-2 text-muted-foreground/70">
                      …
                    </span>
                  );
                }
                return null;
              }
              const isActive = page === currentPage;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 min-w-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-gradient-to-r from-primary/90 to-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-primary/10 text-foreground'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 rounded-lg hover:bg-primary/10"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              aria-label="Next page"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
