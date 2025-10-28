/**
 * Utility function to generate drivers allocation data from canvas
 * This is called during export to populate the drivers array in the project data
 */

import { allocateDrivers, LayerInfo, Driver } from '@/utils/dimmingEngine/allocateDrivers';
import * as fabric from 'fabric';

interface ZoneWithLayers {
  zoneId: string;
  layers: Array<{
    layerId: string;
    objectIds: string[];
  }>;
}

/**
 * Generates driver allocation data for all zones
 * @param canvas - Fabric canvas instance
 * @param zones - Array of zones with their layers
 * @param mixMap - Map of zone IDs to mix IDs
 * @returns Object with drivers per zone and warnings
 */
export function generateDriversAllocation(
  canvas: fabric.Canvas | null | undefined,
  zones: ZoneWithLayers[],
  mixMap: Record<string, string>
): {
  driversByZone: Record<string, Driver[]>;
  warnings: string[];
} {
  const driversByZone: Record<string, Driver[]> = {};
  const allWarnings: string[] = [];

  if (!canvas) {
    return { driversByZone, warnings: allWarnings };
  }

  const canvasObjects = canvas.getObjects();

  // Process each zone
  for (const zone of zones) {
    const layers: LayerInfo[] = [];

    // Process each layer in the zone
    for (const layer of zone.layers) {
      const fixtures: Array<{
        id: string;
        channelCount: number;
        wattPower: number;
      }> = [];

      // Get all fixtures in this layer
      for (const objectId of layer.objectIds) {
        const fabricObj = canvasObjects.find(obj => obj.get('id') === objectId);
        if (fabricObj) {
          const channelCount = (fabricObj.get('channelCount') as number | null) ?? 3;
          const wattPower = (fabricObj.get('wattPower') as number | null) ?? 0;

          fixtures.push({
            id: objectId,
            channelCount,
            wattPower,
          });
        }
      }

      if (fixtures.length > 0) {
        layers.push({
          layerId: layer.layerId,
          zoneId: zone.zoneId,
          mixId: mixMap[zone.zoneId] || '',
          fixtures,
        });
      }
    }

    // Only allocate drivers if there are layers with fixtures
    if (layers.length > 0) {
      const { drivers, warnings } = allocateDrivers(layers);
      driversByZone[zone.zoneId] = drivers;
      allWarnings.push(...warnings);
    }
  }

  return {
    driversByZone,
    warnings: allWarnings,
  };
}
