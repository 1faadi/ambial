import { useMutation } from '@tanstack/react-query';
import { lightingService } from '@/services/lightingService';

export function useLightingSuggestion() {
  // Mutation for getting lighting suggestions
  const lightingSuggestionMutation = useMutation<string, Error, string>({
    mutationFn: async (base64Image: string) => {
      return await lightingService.getLightingSuggestion(base64Image);
    },
  });

  return {
    getLightingSuggestion: lightingSuggestionMutation.mutateAsync,
    isLoadingLighting: lightingSuggestionMutation.isPending,
    lightingError: lightingSuggestionMutation.error,
    lightingData: lightingSuggestionMutation.data,
    lightingMutation: lightingSuggestionMutation,
  };
}
