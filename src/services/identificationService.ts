import axios from 'axios';
import { FloorPlanSegmentationResponse, RoomAnalysis } from '@/types/interfaces';

class IdentificationService {
  private readonly API_URL: string;
  private readonly API_KEY: string;

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY;
    if (!apiKey) {
      throw new Error('ROBOFLOW_API_KEY environment variable is not set');
    }
    this.API_KEY = apiKey;
    this.API_URL =
      process.env.NEXT_PUBLIC_ROBOFLOW_API_URL ||
      'https://serverless.roboflow.com/floor-plans-zeb7z/8';
    // this.API_URL = 'https://serverless.roboflow.com/room-detection-6nzte/1';
  }

  async segmentFloorPlan(image: string): Promise<FloorPlanSegmentationResponse> {
    try {
      const response = await axios({
        method: 'POST',
        url: this.API_URL,
        params: {
          api_key: this.API_KEY,
        },
        data: image,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const data: FloorPlanSegmentationResponse = response.data;
      const filtered: FloorPlanSegmentationResponse = {
        ...data,
        predictions: Array.isArray(data.predictions)
          ? data.predictions.filter(
              p => typeof p.class === 'string' && !p.class.toLowerCase().includes('wall')
            )
          : [],
      };

      return filtered;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Floor plan segmentation failed: ${error.message}`);
      }
      throw new Error('Floor plan segmentation failed with unknown error');
    }
  }

  async analyzeRoom(imageBase64: string): Promise<RoomAnalysis> {
    try {
      const response = await axios.post('/api/analyze-room', {
        imageBase64,
      });
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Room analysis failed: ${error.message}`);
      }
      throw new Error('Room analysis failed with unknown error');
    }
  }
}
export const identificationService = new IdentificationService();
