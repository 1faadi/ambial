'use client';
import Header from '@/components/Header';
import FixtureLibraryTable, { FixtureRow } from '@/components/fixtures/FixtureLibraryTable';
import AddFixtureDialog from '@/components/fixtures/AddFixtureDialog';
import EditFixtureDialog from '@/components/fixtures/EditFixtureDialog';
import { useMemo, useState } from 'react';
import { useFixtures } from '@/hooks/useFixtures';
import type { CreateFixtureData } from '@/types/interfaces';
import DeleteConfirmationDialog from '@/components/dialogs/DeleteConfirmationDialog';
import { toast } from 'sonner';

export default function FixtureLibraryScreen() {
  const {
    fixtures,
    createFixture,
    updateFixture,
    deleteFixture,
    isLoadingFixtures,
    isDeletingFixture,
  } = useFixtures();
  const rows = useMemo<FixtureRow[]>(() => {
    if (!fixtures) return [];
    return fixtures.map(f => ({
      id: f.sequentialId || 0,
      backendId: f.id,
      sidebarId: f.sidebarId ?? undefined,
      type: f.fixtureType,
      modelName: f.modelName,
      sizeIn: f.sizeIn ?? undefined,
      manufacturer: f.manufacturer,
      price: f.price ?? undefined,
      lumens: f.lumens ?? undefined,
      peakPowerW: f.peakPowerW ?? undefined,
      maxVoltageV: f.maxVoltageV ?? undefined,
      maxCurrentA: f.maxCurrentA ?? undefined,
      minPwm: f.minPWM ?? undefined,
      maxPwm: f.maxPWM ?? undefined,
      dimmingMode: f.dimmingMode ?? undefined,
      dimmingCurve: f.dimmingCurve ?? undefined,
      minCct: f.minCCT ?? undefined,
      midCct: f.midCCT ?? undefined,
      maxCct: f.maxCCT ?? undefined,
      channelCount: f.channelCount ?? undefined,
      dimmingGamma: f.dimmingGamma ?? undefined,
    }));
  }, [fixtures]);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<FixtureRow | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<FixtureRow | undefined>(undefined);

  const onAdd = () => setAddOpen(true);
  const onEdit = (row: FixtureRow) => {
    setEditing(row);
    setEditOpen(true);
  };
  const onDelete = (row: FixtureRow) => {
    setDeleting(row);
    setDeleteOpen(true);
  };
  const onCreate = async (row: Omit<FixtureRow, 'id'>) => {
    const payload: CreateFixtureData = {
      fixtureType: row.type,
      modelName: row.modelName ?? '',
      sizeIn: row.sizeIn ? Number(row.sizeIn) : null,
      manufacturer: row.manufacturer ?? '',
      price: row.price ?? null,
      lumens: row.lumens ?? null,
      peakPowerW: row.peakPowerW ?? null,
      maxVoltageV: row.maxVoltageV ?? null,
      maxCurrentA: row.maxCurrentA ?? null,
      minPWM: row.minPwm ?? null,
      maxPWM: row.maxPwm ?? null,
      dimmingMode: row.dimmingMode ?? null,
      dimmingCurve: row.dimmingCurve ?? null,
      minCCT: row.minCct ?? null,
      midCCT: row.midCct ?? null,
      maxCCT: row.maxCct ?? null,
      sidebarId: row.sidebarId ?? null,
      channelCount: row.channelCount ?? null,
      dimmingGamma: row.dimmingGamma ?? null,
    };
    await createFixture(payload);
    setAddOpen(false);
    toast.success(`Fixture "${row.modelName}" created successfully!`);
  };
  const onSave = async (row: FixtureRow) => {
    if (!row?.backendId) return;
    await updateFixture({
      id: row.backendId,
      data: {
        fixtureType: row.type,
        modelName: row.modelName ?? '',
        sizeIn: row.sizeIn ? Number(row.sizeIn) : null,
        manufacturer: row.manufacturer ?? '',
        price: row.price ?? null,
        lumens: row.lumens ?? null,
        peakPowerW: row.peakPowerW ?? null,
        maxVoltageV: row.maxVoltageV ?? null,
        maxCurrentA: row.maxCurrentA ?? null,
        minPWM: row.minPwm ?? null,
        maxPWM: row.maxPwm ?? null,
        dimmingMode: row.dimmingMode ?? null,
        dimmingCurve: row.dimmingCurve ?? null,
        minCCT: row.minCct ?? null,
        midCCT: row.midCct ?? null,
        maxCCT: row.maxCct ?? null,
        sidebarId: row.sidebarId ?? null,
        channelCount: row.channelCount ?? null,
        dimmingGamma: row.dimmingGamma ?? null,
      },
    });
    setEditOpen(false);
    toast.success(`Fixture "${row.modelName}" updated successfully!`);
  };

  const onConfirmDelete = async () => {
    if (!deleting?.backendId) return;
    const modelName = deleting.modelName;
    await deleteFixture(deleting.backendId);
    setDeleteOpen(false);
    setDeleting(undefined);
    toast.success(`Fixture "${modelName}" deleted successfully!`);
  };

  return (
    <>
      <Header breadcrumbs={['Home', 'Fixture Library']} />

      <div className="mx-[127px] my-10 space-y-6">
        <div className="py-2 space-y-[6px]">
          <h1 className="text-2xl font-semibold tracking-tight">Fixture Library</h1>
          <p className="text-muted-foreground text-base">
            Create, compare, and configure your luminaires.
          </p>
        </div>
        <div className="space-y-[10px]">
          <FixtureLibraryTable
            data={rows}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            isLoading={isLoadingFixtures}
          />
        </div>
      </div>

      <AddFixtureDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={onCreate} />
      <EditFixtureDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        row={editing}
        onSubmit={onSave}
      />
      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDelete={onConfirmDelete}
        isLoading={isDeletingFixture}
      />
    </>
  );
}
