import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fixturesService } from '@/services/fixturesService';
import { CreateFixtureData } from '@/types/interfaces';
import { Fixture } from '@prisma/client';

const FIXTURES_QUERY_KEY = 'fixtures';

export function useFixtures() {
  const queryClient = useQueryClient();

  const { data: fixtures, isLoading: isLoadingFixtures } = useQuery({
    queryKey: [FIXTURES_QUERY_KEY],
    queryFn: () => fixturesService.getFixtures(),
  });

  const createFixture = useMutation({
    mutationFn: (data: CreateFixtureData) => fixturesService.createFixture(data),
    onMutate: async (variables: CreateFixtureData) => {
      await queryClient.cancelQueries({ queryKey: [FIXTURES_QUERY_KEY] });
      const previous = queryClient.getQueryData<Fixture[]>([FIXTURES_QUERY_KEY]);

      const optimistic: Fixture = {
        id: `optimistic-${Date.now()}`,
        fixtureType: variables.fixtureType,
        modelName: variables.modelName,
        sizeIn: variables.sizeIn ?? null,
        manufacturer: variables.manufacturer,
        price: variables.price ?? null,
        lumens: variables.lumens ?? null,
        peakPowerW: variables.peakPowerW ?? null,
        maxVoltageV: variables.maxVoltageV ?? null,
        maxCurrentA: variables.maxCurrentA ?? null,
        minPWM: variables.minPWM ?? null,
        maxPWM: variables.maxPWM ?? null,
        dimmingMode: variables.dimmingMode ?? null,
        dimmingCurve: variables.dimmingCurve ?? null,
        minCCT: variables.minCCT ?? null,
        midCCT: variables.midCCT ?? null,
        maxCCT: variables.maxCCT ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sidebarId: variables.sidebarId ?? null,
        userId: 'optimistic',
        channelCount: variables.channelCount ?? null,
        dimmingGamma: variables.dimmingGamma ?? null,
      };

      queryClient.setQueryData<Fixture[]>([FIXTURES_QUERY_KEY], old =>
        old ? [optimistic, ...old] : [optimistic]
      );

      return { previous, optimisticId: optimistic.id };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData([FIXTURES_QUERY_KEY], context.previous);
      }
    },
    onSuccess: (created, _vars, context) => {
      queryClient.setQueryData<Fixture[]>([FIXTURES_QUERY_KEY], old => {
        if (!old || old.length === 0) return [created];
        const idx = old.findIndex(f => f.id === context?.optimisticId);
        if (idx === -1) return [created, ...old];
        const next = [...old];
        next[idx] = created;
        return next;
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [FIXTURES_QUERY_KEY] });
    },
  });

  const updateFixture = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFixtureData> }) =>
      fixturesService.updateFixture(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: [FIXTURES_QUERY_KEY] });
      const previous = queryClient.getQueryData<Fixture[]>([FIXTURES_QUERY_KEY]);
      queryClient.setQueryData<Fixture[]>([FIXTURES_QUERY_KEY], old =>
        old ? old.map(f => (f.id === id ? { ...f, ...mapCreateToFixturePartial(data) } : f)) : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData([FIXTURES_QUERY_KEY], context.previous);
    },
    onSuccess: updated => {
      queryClient.setQueryData<Fixture[]>([FIXTURES_QUERY_KEY], old =>
        old ? old.map(f => (f.id === updated.id ? updated : f)) : [updated]
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [FIXTURES_QUERY_KEY] });
    },
  });

  const deleteFixture = useMutation({
    mutationFn: (id: string) => fixturesService.deleteFixture(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: [FIXTURES_QUERY_KEY] });
      const previous = queryClient.getQueryData<Fixture[]>([FIXTURES_QUERY_KEY]);
      queryClient.setQueryData<Fixture[]>([FIXTURES_QUERY_KEY], old =>
        old ? old.filter(f => f.id !== id) : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData([FIXTURES_QUERY_KEY], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [FIXTURES_QUERY_KEY] });
    },
  });

  function mapCreateToFixturePartial(data: Partial<CreateFixtureData>): Partial<Fixture> {
    return {
      fixtureType: data.fixtureType,
      modelName: data.modelName,
      sizeIn: data.sizeIn ?? undefined,
      manufacturer: data.manufacturer,
      price: data.price ?? undefined,
      lumens: data.lumens ?? undefined,
      peakPowerW: data.peakPowerW ?? undefined,
      maxVoltageV: data.maxVoltageV ?? undefined,
      maxCurrentA: data.maxCurrentA ?? undefined,
      minPWM: data.minPWM ?? undefined,
      maxPWM: data.maxPWM ?? undefined,
      dimmingMode: data.dimmingMode,
      dimmingCurve: data.dimmingCurve,
      minCCT: data.minCCT ?? undefined,
      midCCT: data.midCCT ?? undefined,
      maxCCT: data.maxCCT ?? undefined,
      sidebarId: data.sidebarId ?? undefined,
      channelCount: data.channelCount ?? undefined,
    };
  }

  return {
    fixtures,
    isLoadingFixtures,
    createFixture: createFixture.mutateAsync,
    isCreatingFixture: createFixture.isPending,
    createFixtureError: createFixture.error,
    updateFixture: updateFixture.mutateAsync,
    isUpdatingFixture: updateFixture.isPending,
    deleteFixture: deleteFixture.mutateAsync,
    isDeletingFixture: deleteFixture.isPending,
  };
}
