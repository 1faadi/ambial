import { useMutation } from '@tanstack/react-query';
import { identificationService } from '@/services/identificationService';
import { FloorPlanSegmentationResponse, RoomAnalysis } from '@/types/interfaces';

export function useIdentification() {
  // Mutation for segmenting floor plan
  const segmentFloorPlanMutation = useMutation<FloorPlanSegmentationResponse, Error, string>({
    mutationFn: async (image: string) => {
      return await identificationService.segmentFloorPlan(image);
    },
  });

  // Mutation for analyzing room from cropped image
  const analyzeRoomMutation = useMutation<RoomAnalysis, Error, string>({
    mutationFn: async (imageBase64: string) => {
      return await identificationService.analyzeRoom(imageBase64);
    },
  });

  return {
    segmentFloorPlan: segmentFloorPlanMutation.mutateAsync,
    isSegmenting: segmentFloorPlanMutation.isPending,
    segmentError: segmentFloorPlanMutation.error,
    segmentData: segmentFloorPlanMutation.data,
    segmentMutation: segmentFloorPlanMutation,
    analyzeRoom: analyzeRoomMutation.mutateAsync,
    isAnalyzingRoom: analyzeRoomMutation.isPending,
    analyzeRoomError: analyzeRoomMutation.error,
    analyzeRoomData: analyzeRoomMutation.data,
  };
}
