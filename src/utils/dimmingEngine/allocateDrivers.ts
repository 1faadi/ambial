/**
 * Dimming Engine Driver Allocation Algorithm
 *
 * Requirements:
 * - Each driver has 6 slots
 * - 3-channel fixtures take 3 slots; 2-channel take 2 slots
 * - Each driver can power up to 96W total
 * - One Dimming Engine contains up to 16 drivers
 * - If a layer exceeds driver capacity, it spills to another driver
 * - Additional drivers beyond 16 require a second cabinet (warning)
 */

export interface FixtureInfo {
  id: string; // objectId
  channelCount: number;
  wattPower: number;
}

export interface LayerInfo {
  layerId: string;
  zoneId: string;
  mixId: string;
  fixtures: FixtureInfo[];
}

export interface HardwareOutput {
  layerId: string;
  zoneId: string;
  mixId: string;
  fixtureId: string;
  hwOut: number[]; // Slots used: [0], [1,2], etc.
}

export interface Driver {
  id: number;
  address: number;
  cabinetId: string;
  power: {
    budgetW: number;
    estimatedLoadW: number;
  };
  layerAssign: HardwareOutput[];
}

/**
 * Allocates fixtures across drivers based on constraints
 * @param layers - Array of layers with their fixtures
 * @param maxDriversPerCabinet - Maximum drivers per cabinet (default: 16)
 * @returns Object containing drivers array and warnings
 */
export function allocateDrivers(
  layers: LayerInfo[],
  maxDriversPerCabinet: number = 16
): {
  drivers: Driver[];
  warnings: string[];
  requiresMultipleCabinets: boolean;
} {
  const warnings: string[] = [];
  const drivers: Driver[] = [];
  const MAX_SLOTS_PER_DRIVER = 6;
  const MAX_WATTS_PER_DRIVER = 96;

  // Track current state of each driver
  interface DriverState {
    slotsUsed: number;
    wattageUsed: number;
    layerAssigns: HardwareOutput[];
  }

  const driverStates: Map<number, DriverState> = new Map();

  // Helper function to find or create a driver with available slots
  function findOrCreateDriver(
    slotsNeeded: number,
    wattageNeeded: number
  ): { driverId: number; slots: number[] } {
    // Try to find an existing driver with enough space
    for (const [driverId, state] of driverStates.entries()) {
      const slotsAvailable = MAX_SLOTS_PER_DRIVER - state.slotsUsed;
      const wattageAvailable = MAX_WATTS_PER_DRIVER - state.wattageUsed;

      if (slotsAvailable >= slotsNeeded && wattageAvailable >= wattageNeeded) {
        // Allocate slots
        const allocatedSlots: number[] = [];
        for (let i = 0; i < MAX_SLOTS_PER_DRIVER; i++) {
          if (allocatedSlots.length === slotsNeeded) break;
          // Check if this slot is available (not used by any fixture in this driver)
          const slotUsed = state.layerAssigns.some(assign => assign.hwOut.includes(i));
          if (!slotUsed) {
            allocatedSlots.push(i);
          }
        }

        if (allocatedSlots.length === slotsNeeded) {
          state.slotsUsed += slotsNeeded;
          state.wattageUsed += wattageNeeded;
          return { driverId, slots: allocatedSlots };
        }
      }
    }

    // No suitable driver found, create a new one
    const newDriverId = driverStates.size + 1;

    if (newDriverId > maxDriversPerCabinet) {
      warnings.push(
        `Driver count (${newDriverId}) exceeds maximum per cabinet (${maxDriversPerCabinet}). Additional drivers will require a second cabinet.`
      );
    }

    const allocatedSlots: number[] = [];
    for (let i = 0; i < slotsNeeded; i++) {
      allocatedSlots.push(i);
    }

    driverStates.set(newDriverId, {
      slotsUsed: slotsNeeded,
      wattageUsed: wattageNeeded,
      layerAssigns: [],
    });

    return { driverId: newDriverId, slots: allocatedSlots };
  }

  // Process each layer
  for (const layer of layers) {
    for (const fixture of layer.fixtures) {
      const slotsNeeded = fixture.channelCount || 3; // Default to 3 if not specified
      const wattageNeeded = fixture.wattPower || 0;

      // Check constraints
      if (slotsNeeded > MAX_SLOTS_PER_DRIVER) {
        warnings.push(
          `Fixture ${fixture.id} requires ${slotsNeeded} slots, which exceeds driver capacity of ${MAX_SLOTS_PER_DRIVER}`
        );
        continue;
      }

      if (wattageNeeded > MAX_WATTS_PER_DRIVER) {
        warnings.push(
          `Fixture ${fixture.id} requires ${wattageNeeded}W, which exceeds driver capacity of ${MAX_WATTS_PER_DRIVER}W`
        );
        continue;
      }

      // Find or create a driver
      const { driverId, slots } = findOrCreateDriver(slotsNeeded, wattageNeeded);

      // Add to the driver's layer assignments
      const state = driverStates.get(driverId)!;
      state.layerAssigns.push({
        layerId: layer.layerId,
        zoneId: layer.zoneId,
        mixId: layer.mixId,
        fixtureId: fixture.id,
        hwOut: slots,
      });
    }
  }

  // Build driver objects
  let totalDrivers = 0;
  for (const [driverId, state] of driverStates.entries()) {
    totalDrivers++;
    const cabinetNumber = Math.ceil(driverId / maxDriversPerCabinet);
    const addressInCabinet = ((driverId - 1) % maxDriversPerCabinet) + 1;

    drivers.push({
      id: driverId,
      address: addressInCabinet,
      cabinetId: `CAB${cabinetNumber}`,
      power: {
        budgetW: MAX_WATTS_PER_DRIVER,
        estimatedLoadW: state.wattageUsed,
      },
      layerAssign: state.layerAssigns,
    });
  }

  const requiresMultipleCabinets = totalDrivers > maxDriversPerCabinet;

  return {
    drivers,
    warnings,
    requiresMultipleCabinets,
  };
}
