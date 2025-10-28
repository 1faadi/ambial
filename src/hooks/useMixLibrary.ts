import { useState, useEffect } from 'react';
import axiosInstance from '@/lib/axios';

interface Mix {
  id: number;
  layerCount: number;
}

interface MixLibraryData {
  mixLibraryVersion: string;
  units: string;
  indexRange: [number, number];
  layerSequence: {
    [key: string]: string;
  };
  mixes: Mix[];
}

export function useMixLibrary() {
  const [mixLibrary, setMixLibrary] = useState<MixLibraryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchMixLibrary = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get('/api/mix-library');

        if (response.data.mixLibrary) {
          setMixLibrary(response.data.mixLibrary);
        } else {
          setMixLibrary(null);
        }
      } catch (err) {
        console.error('❌ [useMixLibrary] Error fetching mix library:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch mix library');
      } finally {
        setLoading(false);
      }
    };

    fetchMixLibrary();
  }, []);

  // Helper function to get mixes by layer count
  const getMixesByLayerCount = (layerCount: number): Mix[] => {
    if (!mixLibrary) return [];

    const filteredMixes = mixLibrary.mixes.filter(mix => mix.layerCount === layerCount);
    return filteredMixes;
  };

  return {
    mixLibrary,
    loading,
    error,
    getMixesByLayerCount,
  };
}
