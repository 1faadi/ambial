'use client';
import {
  SquarePen,
  ZoomIn,
  ZoomOut,
  Undo,
  Redo,
  Download,
  Save,
  Settings2,
  RotateCcw,
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { useFabricHistory } from '@/hooks/useFabricHistory';
import { useFabricOperations } from '@/hooks/useFabricOperations';
import { useEffect, useState } from 'react';
import { useCanvas } from '@/context/canvasContext';
import ProfileMenu from './ProfileMenu';
import { Switch } from '@/components/ui/Switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu';
import { ComponentType } from '@/utils/enum';
import { useProjects } from '@/hooks/useProjects';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import DashboardHeaderSkeleton from '@/components/skeletons/DashboardHeaderSkeleton';
import EditProjectDialog from '@/components/dialogs/EditProjectDialog';
import CSVPreviewDialog from '@/components/dialogs/CSVPreviewDialog';
import DriverConstraintWarning from '@/components/dialogs/DriverConstraintWarning';
import UnassignedFixturesError from '@/components/dialogs/UnassignedFixturesError';
import { EditProjectFormData } from '@/utils/validations';
import routePaths from '@/lib/routePaths';
import FullScreenLoader from '@/components/ui/FullScreenLoader';
import { FabricObject, Group, Polygon, Line } from 'fabric';
import * as fabric from 'fabric';
import { useRuler } from '@/context/rulerContext';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { isObjectInsidePolygon } from '@/utils/fabric/canvasOperations';
import { RootState } from '@/types/redux';
import { useSelector } from 'react-redux';
import {
  allocateDrivers,
  type Driver,
  type LayerInfo,
} from '@/utils/dimmingEngine/allocateDrivers';

interface ExportRow {
  id: string;
  room: string;
  zone: string;
  layer: string;
  type: string;
  name: string;
  qty: string;
  mfgPartNumber: string;
  description: string;
}

interface PolygonLayer {
  id: string;
  layerId: number;
  name: string;
  objectIds?: string[];
}

interface OrphanedComponent {
  id: string;
  name: string;
  type: string;
  left: number;
  top: number;
}

const DashboardHeader = () => {
  const { undo, redo, canUndo, canRedo, clear } = useFabricHistory();
  const { zoomIn, zoomOut, resetZoom } = useFabricOperations();
  const { canvas, setInitialCanvas, getInitialCanvas, setShouldRecordHistory } = useCanvas();
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const { showRulers, toggleRulers, originX, originY } = useRuler();
  const { updateProject, useProject } = useProjects();
  const params = useParams();
  const projectId = params.projectId as string;
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCSVPreviewOpen, setIsCSVPreviewOpen] = useState(false);
  const [csvPreviewData, setCSVPreviewData] = useState<ExportRow[]>([]);
  const [isConstraintWarningOpen, setIsConstraintWarningOpen] = useState(false);
  const [constraintWarningData, setConstraintWarningData] = useState({
    driversCount: 0,
    maxDriversPerEngine: 16,
    dimmingEngineCount: 0,
  });
  const [isUnassignedErrorOpen, setIsUnassignedErrorOpen] = useState(false);
  const [unassignedFixturesCount, setUnassignedFixturesCount] = useState(0);
  const router = useRouter();
  const { pixelToFeetRatio } = useSelector((state: RootState) => state.canvasReducer);

  useEffect(() => {
    clear();
  }, [pixelToFeetRatio, clear]);

  const [visibilitySettings, setVisibilitySettings] = useState({
    light: true,
    switch: true,
    shape: true,
    overlay: true,
  });

  // // Sync ruler visibility with the ruler context
  // useEffect(() => {
  //   setVisibilitySettings(prev => ({
  //     ...prev,
  //     ruler: showRulers,
  //   }));
  // }, [showRulers]);

  const handleSave = async () => {
    if (!canvas || !projectId) return;

    try {
      setIsSaving(true);
      resetZoom();
      setZoomLevel(100);
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const canvasData = canvas.toJSON();
      const dataURL = canvas.toDataURL({
        format: 'png', // or 'jpeg'
        quality: 1.0, // for jpeg quality (0-1)
        multiplier: 1, // scale factor
      });
      const jsonData = JSON.stringify(canvasData);
      setInitialCanvas(jsonData);
      await updateProject({
        id: projectId,
        data: {
          thumbnail: dataURL,
          data: jsonData,
          canvasWidth: canvas.getWidth(),
          canvasHeight: canvas.getHeight(),
        },
      });
      toast.success('Project saved successfully');
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!canvas || !projectId) return;
    setShouldRecordHistory(false);
    clear();
    resetZoom();
    setZoomLevel(100);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas!.loadFromJSON(getInitialCanvas()).then(() => {
      canvas.getObjects().forEach(obj => {
        if (
          obj.type === 'image' ||
          obj.type === 'text' ||
          obj.type === 'i-text' ||
          obj.type === 'textbox'
        ) {
          obj.set({
            selectable: false,
            evented: false,
          });
        }
      });
      canvas.renderAll();
      setShouldRecordHistory(true);
    });
    setShouldRecordHistory(true);
  };

  const toggleCategoryVisibility = (category: ComponentType) => {
    // Handle ruler separately since it uses a different context
    if (category === ComponentType.Ruler) {
      toggleRulers();
      return;
    }

    const newVisibility = !visibilitySettings[category];

    setVisibilitySettings(prev => ({
      ...prev,
      [category]: newVisibility,
    }));

    if (canvas) {
      let shouldClearSelection = false;
      const activeObject = canvas.getActiveObject();

      const applyVisibility = (obj: FabricObject) => {
        const objCategory = obj.get('shapeCategory') as ComponentType | undefined;

        if (objCategory === category) {
          obj.set('visible', newVisibility);

          if (!newVisibility && activeObject === obj) {
            shouldClearSelection = true;
          }
        }

        // If it's a group, check its children too
        if (obj.type === 'group' && 'getObjects' in obj) {
          const group = obj as Group;
          group.getObjects().forEach(child => applyVisibility(child));
        }
      };

      canvas.getObjects().forEach(obj => applyVisibility(obj));

      if (shouldClearSelection) {
        canvas.discardActiveObject();
      }

      canvas.renderAll();
    }
  };

  const handleZoomIn = () => {
    zoomIn();
    if (canvas) {
      const newZoom = Math.round(canvas.getZoom() * 100);
      setZoomLevel(newZoom);
    }
  };

  // Handle zoom out
  const handleZoomOut = () => {
    zoomOut();
    if (canvas) {
      const newZoom = Math.round(canvas.getZoom() * 100);
      setZoomLevel(newZoom);
    }
  };

  // Handle reset zoom
  const handleResetZoom = () => {
    resetZoom();
    if (canvas) {
      setZoomLevel(100);
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    }
  };

  const handleEditProject = async (data: EditProjectFormData) => {
    try {
      setIsSavingName(true);
      await updateProject({
        id: projectId,
        data: {
          name: data.name,
        },
      });
      toast.success('Project name updated successfully');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project name');
      throw error;
    } finally {
      setIsSavingName(false);
    }
  };

  if (isProjectLoading) {
    return <DashboardHeaderSkeleton />;
  }

  const handleLogoClick = async () => {
    await handleSave(); // wait for save to complete
    router.push(routePaths.HomeScreen); // then navigate
  };

  // Helper function to check for unassigned fixtures
  const checkForUnassignedFixtures = (): { hasUnassigned: boolean; count: number } => {
    if (!canvas) return { hasUnassigned: false, count: 0 };

    const UNASSIGNED_LAYER_NAME = 'Unassigned';
    let unassignedCount = 0;

    // Check all zones
    const zoneObjects = canvas.getObjects().filter(obj => obj.type === 'polygon');

    for (const zone of zoneObjects) {
      const layers = zone.get('layers') || [];

      // Find the Unassigned layer
      const unassignedLayer = layers.find(
        (layer: Record<string, unknown>) => (layer.name as string) === UNASSIGNED_LAYER_NAME
      );

      if (unassignedLayer) {
        const objectIds = (unassignedLayer.objectIds as string[]) || [];
        unassignedCount += objectIds.length;
      }
    }

    return {
      hasUnassigned: unassignedCount > 0,
      count: unassignedCount,
    };
  };

  // Helper to generate drivers allocation data (canvas-wide, not zone-specific)
  const generateDriversData = (): {
    drivers: Driver[] | null;
    validation: {
      isValid: boolean;
      dimmingEngineCount: number;
      driversCount: number;
      exceedsMaxDrivers: boolean;
      maxDriversPerEngine: number;
    };
  } => {
    const MAX_DRIVERS_PER_ENGINE = 16;

    if (!canvas) {
      return {
        drivers: null,
        validation: {
          isValid: true,
          dimmingEngineCount: 0,
          driversCount: 0,
          exceedsMaxDrivers: false,
          maxDriversPerEngine: MAX_DRIVERS_PER_ENGINE,
        },
      };
    }

    // Check if any dimming engines exist on canvas
    // Dimming engines have shapeId: 7
    const dimmingEngines = canvas.getObjects().filter(obj => {
      return obj.get('shapeId') === 7;
    });

    // Log for debugging
    console.log('🔍 Dimming engines found:', dimmingEngines.length);
    if (dimmingEngines.length === 0) {
      console.log('⚠️  No dimming engines detected. Checking all objects on canvas...');
      canvas.getObjects().forEach(obj => {
        const name = obj.get('name');
        const type = obj.type;
        const shapeId = obj.get('shapeId');
        if (type !== 'polygon') {
          console.log(`  - Name: "${name}", Type: "${type}", ShapeId: ${shapeId}`);
        }
      });
    }

    // If no dimming engines, don't calculate drivers
    if (dimmingEngines.length === 0) {
      console.log('❌ No dimming engines (shapeId 7) found - drivers not calculated');
      return {
        drivers: null,
        validation: {
          isValid: true,
          dimmingEngineCount: 0,
          driversCount: 0,
          exceedsMaxDrivers: false,
          maxDriversPerEngine: MAX_DRIVERS_PER_ENGINE,
        },
      };
    }

    console.log('✅ Dimming engines detected - calculating drivers...');

    // Collect ALL layers from ALL zones
    const allLayers: LayerInfo[] = [];

    // Get all polygon zones
    const zoneObjects = canvas.getObjects().filter(obj => obj.type === 'polygon');

    // Process each zone with layers
    for (const zoneObj of zoneObjects) {
      // Use the zone's own zoneId (e.g., "Z1") instead of the internal id (uuid)
      const zoneId =
        (zoneObj.get('zoneId') as string) ||
        (zoneObj.get('exportId') as string) ||
        (zoneObj.get('id') as string);
      // Use the mix attribute present on the zone for mixId
      const zoneMix = (zoneObj.get('mix') as string) || '';
      const polygonLayers = zoneObj.get('layers') || [];

      if (!polygonLayers || polygonLayers.length === 0) continue;

      const layers: LayerInfo[] = polygonLayers
        .map((layer: Record<string, unknown>) => {
          const fixtures = ((layer.objectIds as string[]) || [])
            .map((objectId: string) => {
              const fabricObj = canvas.getObjects().find(obj => obj.get('id') === objectId);
              if (!fabricObj) return null;

              return {
                id: objectId,
                channelCount: (fabricObj.get('channelCount') as number | null) ?? 3,
                wattPower: (fabricObj.get('wattPower') as number | null) ?? 0,
              };
            })
            .filter(
              (f): f is { id: string; channelCount: number; wattPower: number } => f !== null
            );

          return {
            // Use layer.layerId instead of the layer's internal id
            layerId: String(
              (layer.layerId as number | string | undefined) ?? (layer.id as string) ?? ''
            ),
            // Use the zone's zoneId (e.g., "Z1")
            zoneId: zoneId,
            // Use the zone's mix attribute for mixId
            mixId: zoneMix,
            fixtures,
          };
        })
        .filter((l: LayerInfo) => l.fixtures.length > 0);

      allLayers.push(...layers);
    }

    // Allocate all fixtures across drivers (global allocation, not per-zone)
    if (allLayers.length > 0) {
      const { drivers } = allocateDrivers(allLayers);
      console.log(
        `✅ Drivers allocated: ${drivers.length} drivers created for fixtures across all zones`
      );

      // Check if drivers exceed max per all dimming engines combined
      const maxTotalDrivers = MAX_DRIVERS_PER_ENGINE * dimmingEngines.length;
      const exceedsMaxDrivers = drivers.length > maxTotalDrivers;

      if (exceedsMaxDrivers) {
        console.warn(
          `⚠️  WARNING: ${drivers.length} drivers required, but max per engine is ${MAX_DRIVERS_PER_ENGINE}`
        );
      }

      return {
        drivers: drivers.length > 0 ? drivers : null,
        validation: {
          isValid: !exceedsMaxDrivers,
          dimmingEngineCount: dimmingEngines.length,
          driversCount: drivers.length,
          exceedsMaxDrivers,
          maxDriversPerEngine: MAX_DRIVERS_PER_ENGINE,
        },
      };
    }

    return {
      drivers: null,
      validation: {
        isValid: true,
        dimmingEngineCount: dimmingEngines.length,
        driversCount: 0,
        exceedsMaxDrivers: false,
        maxDriversPerEngine: MAX_DRIVERS_PER_ENGINE,
      },
    };
  };

  // Helper to check for orphaned components (components outside zones)
  const checkForOrphanedComponents = () => {
    if (!canvas) return { hasOrphans: false, orphanedComponents: [] };

    const allObjects = canvas.getObjects();
    const polygons = allObjects.filter(obj => obj.type === 'polygon') as Polygon[];

    // Get all components (non-polygon, non-line objects with shapeCategory)
    const components = allObjects.filter(
      obj =>
        obj.type !== 'polygon' && obj.type !== 'line' && obj.get('shapeCategory') && obj.get('name')
    );

    const orphanedComponents: OrphanedComponent[] = [];

    components.forEach(component => {
      let isInsideAnyZone = false;

      // Check if component is inside any polygon
      for (const polygon of polygons) {
        const isInside = isObjectInsidePolygon(component, polygon);

        if (isInside) {
          isInsideAnyZone = true;
          break;
        }
      }

      if (!isInsideAnyZone) {
        orphanedComponents.push({
          id: component.get('id'),
          name: component.get('name'),
          type: component.get('shapeType') || component.get('type'),
          left: component.left,
          top: component.top,
        });
      }
    });

    return {
      hasOrphans: orphanedComponents.length > 0,
      orphanedComponents,
    };
  };

  // Helper to get exportable data for CSV
  const getExportRows = () => {
    if (!canvas) return [];

    // Check for orphaned components first
    const { hasOrphans, orphanedComponents } = checkForOrphanedComponents();
    if (hasOrphans) {
      const orphanNames = orphanedComponents.map(c => c.name).join(', ');
      toast.error(`Cannot export: Components outside zones detected: ${orphanNames}`);
      return [];
    }

    // Force regenerate export IDs before export to ensure they're up to date
    // This ensures the latest zone and room assignments are used
    setTimeout(() => {
      // This will be called by the sidebar's generateAndStoreExportIds function
      // We need to trigger it from here to ensure it runs before export
    }, 0);

    const allObjects = canvas.getObjects();

    // Only include objects that are not polygons and have the required properties
    const baseRows = allObjects
      .filter(obj => obj.type !== 'polygon' && obj.get('shapeCategory') && obj.get('name'))
      .map(obj => {
        // Generate ID from componentNumber and other properties
        const componentNumber = obj.get('componentNumber');
        const shapeId = obj.get('shapeId');
        const zoneId = obj.get('zoneId') || obj.get('polygonId') || '';
        const layerId = obj.get('layerExportId') || '';

        // Determine component prefix based on shapeId
        let componentPrefix = '';
        if (shapeId) {
          if ([1, 2, 4, 5, 6, 8].includes(shapeId)) {
            componentPrefix = 'F';
          } else if ([3, 7, 13].includes(shapeId)) {
            componentPrefix = 'C';
          }
        }

        // Generate ID using the same format as in CanvasSidebar
        const fullId =
          componentNumber && componentPrefix && zoneId
            ? `${componentPrefix}${componentNumber}_${zoneId}${layerId ? `_${layerId}` : ''}`
            : obj.get('exportId') || obj.get('componentId') || obj.get('id') || '';

        // Trim ID to first underscore (exclude boundaries that start with 'B')
        const id = fullId.startsWith('B') ? '' : fullId.split('_')[0];

        const room = obj.get('roomName') || '';
        const zone = obj.get('zoneId') || '';
        const layer = obj.get('layerExportId') || '';

        return {
          id,
          room,
          zone,
          layer,
          type: obj.get('shapeType') || '',
          name: obj.get('name') || '',
          qty: '',
          mfgPartNumber: '',
          description: '',
        };
      })
      .filter(row => row.id !== ''); // Remove rows with empty IDs (boundaries)

    // Group rows by their unique combination of properties to calculate quantities
    const groupedRows = new Map<string, ExportRow>();

    baseRows.forEach(row => {
      // Create a unique key based on the combination of properties that should be the same
      // for components that should be grouped together
      const key = `${row.room}|${row.zone}|${row.layer}|${row.type}|${row.name}`;

      if (groupedRows.has(key)) {
        // If we already have this combination, increment the quantity
        const existingRow = groupedRows.get(key);
        if (existingRow) {
          const currentQty = parseInt(existingRow.qty) || 1;
          existingRow.qty = (currentQty + 1).toString();
        }
      } else {
        // First occurrence of this combination, set quantity to 1
        row.qty = '1';
        groupedRows.set(key, row);
      }
    });

    // Convert grouped rows back to array and sort
    const rows = Array.from(groupedRows.values()).sort((a, b) => {
      // Extract letter and number parts from ID for proper alphanumeric sorting
      const extractParts = (str: string) => {
        const letterMatch = str.match(/^[A-Za-z]+/);
        const numberMatch = str.match(/\d+$/);
        return {
          letter: letterMatch ? letterMatch[0].toUpperCase() : '',
          number: numberMatch ? parseInt(numberMatch[0], 10) : 0,
        };
      };

      const aParts = extractParts(a.id);
      const bParts = extractParts(b.id);

      // First sort by letter (alphabetically)
      if (aParts.letter !== bParts.letter) {
        return aParts.letter.localeCompare(bParts.letter);
      }

      // If letters are the same, sort by number
      return aParts.number - bParts.number;
    });

    return rows;
  };

  // Download as JSON
  const handleDownloadJSON = () => {
    if (!canvas) return;

    // Force regenerate export IDs before export to ensure they're up to date
    if (canvas) {
      // Trigger the sidebar's export ID generation
      const event = new CustomEvent('regenerateExportIds');
      window.dispatchEvent(event);
    }

    // Wait a bit for the export IDs to be regenerated
    setTimeout(() => {
      // Check for orphaned components first
      const { hasOrphans, orphanedComponents } = checkForOrphanedComponents();
      if (hasOrphans) {
        const orphanNames = orphanedComponents.map(c => c.name).join(', ');
        toast.error(`Cannot export JSON: Components outside zones detected: ${orphanNames}`);
        return;
      }

      // Check for unassigned fixtures
      const { hasUnassigned, count: unassignedCount } = checkForUnassignedFixtures();
      if (hasUnassigned) {
        setUnassignedFixturesCount(unassignedCount);
        setIsUnassignedErrorOpen(true);
        toast.error(
          `Cannot export: ${unassignedCount} fixture${unassignedCount > 1 ? 's' : ''} in Unassigned layer`
        );
        return;
      }

      // Get all polygon objects (zones) from the canvas
      const allObjects = canvas.getObjects();
      const zoneObjects = allObjects.filter(obj => obj.type === 'polygon') as Polygon[];

      // const LayerObjectsInZone = zoneObjects.map(zone => {
      //   const layers = zone.get('layers') || [];
      //   return layers.flatMap((layer: PolygonLayer) => layer.objectIds || []);
      // });
      // const allLayerObjectIds = new Set(LayerObjectsInZone.flat());

      // // Find fabric objects that match those IDs and log them
      // const layerFabricObjects = canvas
      //   ? canvas.getObjects().filter(obj => allLayerObjectIds.has(obj.get('id')))
      //   : [];

      console.log('🚀🚀🚀🚀 ~ handleDownloadJSON ~ zoneObjects:', zoneObjects);

      const zones = zoneObjects.map((zone, index) => {
        // Get zone geometry (vertices)
        const points = zone.get('points') || [];

        // Convert pixels to feet, then feet to meters for zone vertices
        const convertPixelToMeters = (pixels: number): number => {
          if (!project?.pixelToFeetRatio) {
            return pixels;
          }

          const feet = pixels / (project?.pixelToFeetRatio || 1);
          const meters = feet * 0.3048; // Convert feet to meters
          return meters;
        };

        const vertices = points.map((point: { x: number; y: number }) => {
          // Compute absolute world coordinates correctly using transform matrix and pathOffset
          const absPoint = fabric.util.transformPoint(
            new fabric.Point(point.x - zone.pathOffset.x, point.y - zone.pathOffset.y),
            zone.calcTransformMatrix()
          );

          // Apply origin shift before converting to meters
          const shiftedX = absPoint.x - originX;
          const shiftedY = absPoint.y - originY;

          const xMeters = convertPixelToMeters(shiftedX);
          const yMeters = convertPixelToMeters(shiftedY);

          return [Math.round(xMeters * 100) / 100, Math.round(yMeters * 100) / 100];
        });

        // Get layers directly from the polygon object

        const polygonLayers = zone.get('layers') || [];

        // Create layer map from polygon layers
        const layerMap: Record<
          string,
          {
            id: string;
            name: string;
            layerExportId: string;
            objectIds: string[];
          }
        > = {};

        polygonLayers.forEach((layer: PolygonLayer) => {
          const layerId = layer.id;
          const layerName = layer.name;
          const layerExportId = `L${layer.layerId}`;

          layerMap[layerId] = {
            id: layerId,
            name: layerName,
            layerExportId: layerExportId,
            objectIds: layer.objectIds || [],
          };
        });

        const layers = Object.values(layerMap);

        // Generate numeric layer IDs (remove 'L' prefix)
        const layerIds = layers.map(layer => {
          const numeric = parseInt(String(layer.layerExportId).replace(/\D+/g, ''), 10);
          return Number.isNaN(numeric) ? 0 : numeric;
        });

        return {
          id: index + 1,
          name: zone.get('name') || `Zone ${index + 1}`,
          layerCount: layers.length,
          layerIds: layerIds,
          layers: layers.map(layer => ({
            id: parseInt(String(layer.layerExportId).replace(/\D+/g, ''), 10),
            name: layer.name,
          })),
          geometry: {
            zoneId: index + 1,
            vertexCount: vertices.length,
            vertices: vertices,
          },
        };
      });

      // Get boundary objects (crossing planes) - exclude from main export
      const boundaryObjects = allObjects.filter(
        obj => obj.type === 'line' && obj.get('shapeCategory') === ComponentType.Shape
      ) as Line[];

      const crossingPlanes = boundaryObjects.map((boundary, index) => {
        // Calculate current line coordinates based on current position
        const { x1, y1, x2, y2 } = boundary;

        // The line's center is at (left, top)
        // So we compute the current points relative to the center
        const dx = (x2! - x1!) / 2;
        const dy = (y2! - y1!) / 2;

        const currentX1 = boundary.left! - dx;
        const currentY1 = boundary.top! - dy;
        const currentX2 = boundary.left! + dx;
        const currentY2 = boundary.top! + dy;

        // Convert pixels to feet, then feet to meters
        const convertPixelToMeters = (pixels: number): number => {
          if (!project?.pixelToFeetRatio) {
            return pixels;
          }

          const feet = pixels / (project?.pixelToFeetRatio || 1);
          const meters = feet * 0.3048; // Convert feet to meters
          return meters;
        };

        // Apply origin shift before converting to meters
        const shiftedStartX = currentX1 - originX;
        const shiftedStartY = currentY1 - originY;
        const shiftedEndX = currentX2 - originX;
        const shiftedEndY = currentY2 - originY;

        const startPointMeters = [
          convertPixelToMeters(shiftedStartX),
          convertPixelToMeters(shiftedStartY),
        ];

        const endPointMeters = [
          convertPixelToMeters(shiftedEndX),
          convertPixelToMeters(shiftedEndY),
        ];

        // Get zone information
        const zone1Id = boundary.get('zone1Id') || '';
        const zone2Id = boundary.get('zone2Id') || '';

        // Find zone names by matching zone IDs with zone objects
        const zone1 = zoneObjects.find(zone => zone.get('id') === zone1Id);
        const zone2 = zoneObjects.find(zone => zone.get('id') === zone2Id);

        const zone1Name = zone1?.get('name') || 'Unknown Zone';
        const zone2Name = zone2?.get('name') || 'Unknown Zone';

        // Find zone indices for zoneAId and zoneBId
        const zone1Index = zoneObjects.findIndex(zone => zone.get('id') === zone1Id) + 1;
        const zone2Index = zoneObjects.findIndex(zone => zone.get('id') === zone2Id) + 1;

        // Determine which zone has smaller ID (zoneAId) and which has larger ID (zoneBId)
        const zoneAId = Math.min(zone1Index, zone2Index);
        const zoneBId = Math.max(zone1Index, zone2Index);

        // Get or generate boundary ID from exportId, and normalize by stripping prefix
        let boundaryId = boundary.get('exportId') as string | undefined;
        if (!boundaryId) {
          boundaryId = `B${index + 1}`;
          boundary.set('exportId', boundaryId);
        }
        const numericBoundaryId = parseInt(String(boundaryId).replace(/\D+/g, ''), 10);

        // Get the presence sensor ID from the boundary object
        const presenceSensorId = boundary.get('presenceSensorId');

        // Find the sensor object to get its component number
        let sensorId = null;
        if (presenceSensorId) {
          const sensorObject = allObjects.find(obj => obj.get('id') === presenceSensorId);
          if (sensorObject) {
            const componentNumber = sensorObject.get('componentNumber');
            if (componentNumber) {
              sensorId = componentNumber; // Use the component number as sensor ID
            }
          }
        }

        return {
          planeId: numericBoundaryId,
          name: `${zone1Name} to ${zone2Name}`,
          startPoint: [
            Math.round(startPointMeters[0] * 100) / 100,
            Math.round(startPointMeters[1] * 100) / 100,
          ], // Round to 2 decimal places
          endPoint: [
            Math.round(endPointMeters[0] * 100) / 100,
            Math.round(endPointMeters[1] * 100) / 100,
          ], // Round to 2 decimal places
          zoneAId: zoneAId,
          zoneBId: zoneBId,
          detectionWidth: 500, // Hardcoded as requested
          sensorId: sensorId, // Include the sensor ID from the boundary
        };
      });

      // Get sensors (shapeId 3) and dimmers (shapeId 7, 13)
      const sensors = allObjects.filter(
        obj => obj.get('shapeId') === 3 && obj.type !== 'polygon' && obj.type !== 'line'
      );

      const dimmers = allObjects.filter(
        obj =>
          (obj.get('shapeId') === 7 || obj.get('shapeId') === 13) &&
          obj.type !== 'polygon' &&
          obj.type !== 'line'
      );

      // Convert pixels to meters for position
      const convertPixelToMeters = (pixels: number): number => {
        if (!project?.pixelToFeetRatio) {
          return pixels;
        }

        const feet = pixels / (project?.pixelToFeetRatio || 1);
        const meters = feet * 0.3048; // Convert feet to meters
        return meters;
      };

      const sensorsList = sensors.map(sensor => {
        const componentNumber = sensor.get('componentNumber');
        const position = [
          convertPixelToMeters((sensor.left || 0) - originX),
          convertPixelToMeters((sensor.top || 0) - originY),
        ];

        return {
          ID: componentNumber || 1,
          RoomName: sensor.get('roomName') || '',
          ZoneID: (() => {
            const raw = sensor.get('zoneId') || sensor.get('polygonId') || '';
            const match = String(raw).match(/^[A-Za-z]*(\d+)$/);
            return match ? parseInt(match[1], 10) : raw;
          })(),
          type: 'mmWave',
          position: [Math.round(position[0] * 100) / 100, Math.round(position[1] * 100) / 100],
          range: 5,
        };
      });

      const dimmersList = dimmers.map(dimmer => {
        const componentNumber = dimmer.get('componentNumber');
        const position = [
          convertPixelToMeters((dimmer.left || 0) - originX),
          convertPixelToMeters((dimmer.top || 0) - originY),
        ];

        return {
          ID: componentNumber || 1,
          RoomName: dimmer.get('roomName') || '',
          ZoneID: (() => {
            const raw = dimmer.get('zoneId') || dimmer.get('polygonId') || '';
            const match = String(raw).match(/^[A-Za-z]*(\d+)$/);
            return match ? parseInt(match[1], 10) : raw;
          })(),
          position: [Math.round(position[0] * 100) / 100, Math.round(position[1] * 100) / 100],
        };
      });

      // Generate drivers allocation data if dimming engines exist
      const driversResult = generateDriversData();

      // Check if there's a constraint violation
      if (driversResult.validation && driversResult.validation.exceedsMaxDrivers) {
        // Show warning modal and prevent export
        setConstraintWarningData({
          driversCount: driversResult.validation.driversCount,
          maxDriversPerEngine: driversResult.validation.maxDriversPerEngine,
          dimmingEngineCount: driversResult.validation.dimmingEngineCount,
        });
        setIsConstraintWarningOpen(true);
        toast.error('Cannot export: Dimming engine constraint exceeded. Add a new dimming engine.');
        return;
      }

      const exportData = {
        [project?.name || 'project']: {
          zones: zones,
          crossingPlanes: crossingPlanes,
          sensors: sensorsList,
          dimmers: dimmersList,
          ...(driversResult.drivers && { drivers: driversResult.drivers }),
        },
      };

      const json = JSON.stringify(exportData, null, 2);
      const now = new Date();
      const dateString = now.toLocaleDateString('en-GB').replace(/\//g, '-');
      const timeString = now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '-');
      const filename = `${project?.name || 'project'}-${dateString}-${timeString}.json`;
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 500);
  };

  // Download as CSV
  const handleDownloadCSV = () => {
    // Force regenerate export IDs before export
    // This ensures the latest zone and room assignments are used
    if (canvas) {
      // Trigger the sidebar's export ID generation
      const event = new CustomEvent('regenerateExportIds');
      window.dispatchEvent(event);
    }

    // Wait a bit for the export IDs to be regenerated
    setTimeout(() => {
      // Check for unassigned fixtures
      const { hasUnassigned, count: unassignedCount } = checkForUnassignedFixtures();
      if (hasUnassigned) {
        setUnassignedFixturesCount(unassignedCount);
        setIsUnassignedErrorOpen(true);
        toast.error(
          `Cannot export: ${unassignedCount} fixture${unassignedCount > 1 ? 's' : ''} in Unassigned layer`
        );
        return;
      }

      const rows = getExportRows();
      if (rows.length === 0) return;

      const header = [
        'ID',
        'Room',
        'Zone',
        'Layer',
        'Type',
        'Name',
        'QTY',
        'MFG Part Number',
        'Description',
      ];
      const csv = [
        header.join(','),
        ...rows.map(row =>
          [
            row.id,
            row.room,
            row.zone,
            row.layer,
            row.type,
            row.name,
            row.qty,
            row.mfgPartNumber,
            row.description,
          ]
            .map(val => `"${String(val).replace(/"/g, '""')}"`)
            .join(',')
        ),
      ].join('\n');
      const now = new Date();
      const dateString = now.toLocaleDateString('en-GB').replace(/\//g, '-');
      const timeString = now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '-');
      const filename = `${project?.name || 'project'}-${dateString}-${timeString}.csv`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 500);
  };

  // Show CSV Preview
  const handleShowCSVPreview = () => {
    // Force regenerate export IDs before preview
    if (canvas) {
      // Trigger the sidebar's export ID generation
      const event = new CustomEvent('regenerateExportIds');
      window.dispatchEvent(event);
    }

    // Wait a bit for the export IDs to be regenerated
    setTimeout(() => {
      const rows = getExportRows();
      setCSVPreviewData(rows);
      setIsCSVPreviewOpen(true);
    }, 500);
  };

  // Download as PDF
  const handleDownloadPDF = () => {
    // Force regenerate export IDs before export
    // This ensures the latest zone and room assignments are used
    if (canvas) {
      // Trigger the sidebar's export ID generation
      const event = new CustomEvent('regenerateExportIds');
      window.dispatchEvent(event);
    }

    // Wait a bit for the export IDs to be regenerated
    setTimeout(() => {
      // Check for unassigned fixtures
      const { hasUnassigned, count: unassignedCount } = checkForUnassignedFixtures();
      if (hasUnassigned) {
        setUnassignedFixturesCount(unassignedCount);
        setIsUnassignedErrorOpen(true);
        toast.error(
          `Cannot export: ${unassignedCount} fixture${unassignedCount > 1 ? 's' : ''} in Unassigned layer`
        );
        return;
      }

      const rows = getExportRows();
      if (rows.length === 0) return;

      // Create PDF content using jsPDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // ===== HEADER SECTION =====
      let currentY = 10;

      // Company Name (Top Left) - Larger size
      doc.setFontSize(32);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(255, 216, 178); // App color (#FFD8B2)
      doc.text('LUNUL', 14, currentY + 8);

      // Project Info Box (Top Right)
      doc.setFontSize(8);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const infoBoxX = 115;
      const infoBoxWidth = pageWidth - infoBoxX - 14;
      const infoBoxHeight = 18;

      // Draw info box border
      doc.setDrawColor(255, 216, 178); // App color (#FFD8B2)
      doc.setLineWidth(0.5);
      doc.rect(infoBoxX, currentY, infoBoxWidth, infoBoxHeight);

      doc.text(`Lighting Plan Version: v1.0`, infoBoxX + 2, currentY + 6);
      doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, infoBoxX + 2, currentY + 12);

      currentY = 42;

      // Project Details Section
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('PROJECT INFORMATION', 14, currentY);

      currentY += 7;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);

      // Prepared For Section - Single line
      doc.setFont('Helvetica', 'bold');
      doc.text('Prepared For:', 14, currentY);
      doc.setFont('Helvetica', 'normal');
      doc.text('Architect: John Smith, AIA | Contractor: Build Pro Construction', 50, currentY);

      currentY += 6;
      doc.setFont('Helvetica', 'bold');
      doc.text(`Project ID:`, 14, currentY);
      doc.setFont('Helvetica', 'normal');
      doc.text(project?.id || 'PRJ-2024-001', 50, currentY);

      currentY += 5;
      doc.setFont('Helvetica', 'bold');
      doc.text(`Project Name:`, 14, currentY);
      doc.setFont('Helvetica', 'normal');
      doc.text(project?.name || 'Sample Commercial Space', 50, currentY);

      currentY += 5;
      doc.setFont('Helvetica', 'bold');
      doc.text(`Address:`, 14, currentY);
      doc.setFont('Helvetica', 'normal');
      doc.text('123 Innovation Drive, Tech City, TC 12345', 50, currentY);

      currentY += 10;

      // ===== TABLE SECTION =====
      const tableStartY = currentY;
      const rowHeight = 7;

      // Define new table headers
      const headers = [
        'Type',
        'Location',
        'Qty',
        'Model',
        'Manufacturer',
        'Size',
        'Lumens',
        'Ext. Cost',
      ];

      // Column widths - span full page width
      const pageMargin = 14;
      const availableWidth = pageWidth - pageMargin * 2;
      const colWidths = [
        (availableWidth * 14) / 116,
        (availableWidth * 18) / 116,
        (availableWidth * 8) / 116,
        (availableWidth * 20) / 116,
        (availableWidth * 18) / 116,
        (availableWidth * 10) / 116,
        (availableWidth * 14) / 116,
        (availableWidth * 14) / 116,
      ];
      let currentX = pageMargin;

      // Draw headers with app color background
      doc.setFontSize(7);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(0, 0, 0); // Black text
      doc.setDrawColor(180, 180, 180); // Neutral gray borders
      doc.setLineWidth(0.3); // Thin borders

      headers.forEach((header, index) => {
        // Draw header cell border
        doc.rect(currentX, tableStartY, colWidths[index], rowHeight);

        // Fill header with app color
        doc.setFillColor(255, 216, 178); // App color (#FFD8B2)
        doc.rect(currentX, tableStartY, colWidths[index], rowHeight, 'F');

        // Draw border again to ensure it's visible
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.rect(currentX, tableStartY, colWidths[index], rowHeight);

        // Center text in header - both horizontally and vertically
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        doc.text(header, currentX + colWidths[index] / 2, tableStartY + rowHeight / 2 + 1, {
          align: 'center',
        });

        currentX += colWidths[index];
      });

      // Prepare enhanced data for table
      const enhancedTableData = rows.map(row => {
        // Find the fabric object to get additional details
        // Compare only the first part of exportId (before first underscore) with row.id
        const fabricObject = canvas?.getObjects().find(obj => {
          const exportId = obj.get('exportId') as string;
          if (!exportId) return false;
          const exportIdPrefix = exportId.split('_')[0];
          return exportIdPrefix === row.id;
        });

        const type = fabricObject?.get('shapeType') || row.type || 'Unknown';
        const location = `${row.zone} / L${row.layer.replace('L', '')}`;
        const qty = row.qty || '1';
        const model = fabricObject?.get('modelName') || row.name || 'N/A';
        const manufacturer = fabricObject?.get('manufacturer') || row.room || 'N/A';
        const sizeValue = fabricObject?.get('sizeIn');
        const size = sizeValue ? String(sizeValue) : 'N/A';
        const lumens = fabricObject?.get('lumens') || 'N/A';
        const unitPrice = fabricObject?.get('unitPrice') || 0;
        const extCost = (parseInt(qty) * unitPrice).toFixed(2);

        return [type, location, qty, model, manufacturer, size, String(lumens), `$${extCost}`];
      });

      // Draw data rows
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      let rowIndex = 0;

      enhancedTableData.forEach((row: string[], index: number) => {
        const y = tableStartY + rowHeight + rowIndex * rowHeight;

        // Add new page if needed
        if (y + rowHeight > doc.internal.pageSize.getHeight() - 10) {
          doc.addPage();
          rowIndex = 0;
          currentY = 10;
        }

        currentX = pageMargin;
        const currentRowY = tableStartY + rowHeight + rowIndex * rowHeight;

        // Alternate row background color
        if (index % 2 === 0) {
          doc.setFillColor(255, 235, 220); // Light app color (#FFD8B2) variant
          for (let i = 0; i < colWidths.length; i++) {
            doc.rect(currentX, currentRowY, colWidths[i], rowHeight, 'F');
            currentX += colWidths[i];
          }
          currentX = pageMargin;
        }

        row.forEach((cell: string, colIndex: number) => {
          // Draw border with thin, neutral color
          doc.setDrawColor(220, 220, 220); // Light gray borders
          doc.setLineWidth(0.2);
          doc.rect(currentX, currentRowY, colWidths[colIndex], rowHeight);

          // Handle text - use smaller font for smaller row height
          doc.setFontSize(6);
          doc.setFont('Helvetica', 'normal');
          doc.setTextColor(0, 0, 0);

          const maxWidth = colWidths[colIndex] - 1;
          const lines = doc.splitTextToSize(String(cell), maxWidth);

          // Draw text centered both horizontally and vertically in the cell
          const cellHeight = rowHeight;
          const totalLinesHeight = lines.length * 2;
          let startY = currentRowY + (cellHeight - totalLinesHeight) / 2 + 2;

          lines.forEach((line: string) => {
            // Center align the text
            doc.text(line, currentX + colWidths[colIndex] / 2, startY, { align: 'center' });
            startY += 2;
          });

          currentX += colWidths[colIndex];
        });

        rowIndex++;
      });

      // Add footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 5,
          { align: 'center' }
        );
      }

      // Save the PDF
      const now = new Date();
      const dateString = now.toLocaleDateString('en-GB').replace(/\//g, '-');
      const timeString = now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '-');
      const filename = `${project?.name || 'project'}-${dateString}-${timeString}.pdf`;

      doc.save(filename);
    }, 500);
  };

  return (
    <>
      {isSaving && <FullScreenLoader />}
      <header className="mx-auto flex gap-1 xl:gap-2 justify-between shrink-0 px-4 py-2 h-[81px] select-none">
        <div className="bg-white border border-light-gray rounded-[8px] flex items-center gap-1 xl:gap-8 py-1 px-1 xl:px-3">
          <div className="relative h-[44px] w-[44px] cursor-pointer" onClick={handleLogoClick}>
            <Image src="/images/ambial_logo.png" alt="logo" priority fill />
          </div>
          <div className="flex items-center gap-[10px] px-[10px]">
            <p className="truncate overflow-ellipsis max-w-[130px] xl:max-w-[280px]">
              {project?.name}
            </p>
            <Button
              variant="ghost"
              className="cursor-pointer"
              onClick={() => setIsEditDialogOpen(true)}
            >
              <SquarePen className="h-6 w-6" />
            </Button>
          </div>
        </div>

        <div className="px-1 xl:px-3 py-[11.5px] bg-white border border-light-gray rounded-[8px] flex gap-3 items-center">
          <Button variant="outline" className="cursor-pointer" onClick={handleZoomOut}>
            <ZoomOut className="h-6 w-6" />
          </Button>
          <span className="font-medium bg-[#F4F4F5] px-[13px] py-[2px] rounded-[30px] cursor-pointer select-none">
            {zoomLevel}%
          </span>
          <Button variant="outline" className="cursor-pointer" onClick={handleZoomIn}>
            <ZoomIn className="h-6 w-6" />
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer text-black font-medium"
            onClick={handleResetZoom}
          >
            <RotateCcw className="h-6 w-6" /> Reset
          </Button>
        </div>

        <div className="px-1 xl:px-3 py-[11.5px] bg-white border border-light-gray rounded-[8px] flex gap-[4px] xl:gap-[10px] items-center">
          <Button
            variant="outline"
            className="cursor-pointer select-none"
            onClick={undo}
            disabled={!canUndo}
            onMouseDown={e => e.preventDefault()}
          >
            <Undo className="h-6 w-6" />
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer select-none"
            onClick={redo}
            disabled={!canRedo}
            onMouseDown={e => e.preventDefault()}
          >
            <Redo className="h-6 w-6" />
          </Button>
        </div>

        <div className="px-2 xl:px-3 py-[11.5px] bg-white border border-light-gray rounded-[8px] flex gap-[6px] xl:gap-[10px] items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" className="cursor-pointer select-none" onClick={() => {}}>
                <Info className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Hold Space to pan the canvas</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="bg-[#F4F4F5] hover:bg-[#F4F4F5] text-black font-medium cursor-pointer select-none"
                onMouseDown={e => e.preventDefault()}
                onKeyDown={e => {
                  if (e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar') {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                <Settings2 />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="flex justify-between">
                Lighting
                <Switch
                  checked={visibilitySettings.light} //switch will be on by default
                  onCheckedChange={() => toggleCategoryVisibility(ComponentType.Light)}
                />
              </DropdownMenuLabel>
              <DropdownMenuLabel className="flex justify-between">
                Control Devices
                <Switch
                  checked={visibilitySettings.switch}
                  onCheckedChange={() => toggleCategoryVisibility(ComponentType.Switch)}
                />
              </DropdownMenuLabel>
              <DropdownMenuLabel className="flex justify-between">
                Control Geometry
                <Switch
                  checked={visibilitySettings.shape}
                  onCheckedChange={() => toggleCategoryVisibility(ComponentType.Shape)}
                />
              </DropdownMenuLabel>
              <DropdownMenuLabel className="flex justify-between">
                Projections
                <Switch
                  checked={visibilitySettings.overlay}
                  onCheckedChange={() => toggleCategoryVisibility(ComponentType.Overlay)}
                />
              </DropdownMenuLabel>
              <DropdownMenuLabel className="flex justify-between">
                Ruler
                <Switch
                  checked={showRulers}
                  onCheckedChange={() => toggleCategoryVisibility(ComponentType.Ruler)}
                />
              </DropdownMenuLabel>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            className="font-medium cursor-pointer select-none"
            onClick={handleDiscard}
            onMouseDown={e => e.preventDefault()}
          >
            Discard
          </Button>
          <Button
            className="bg-[#F4F4F5] hover:bg-[#F4F4F5] text-black font-medium cursor-pointer select-none"
            onClick={handleSave}
            disabled={isSaving}
            onMouseDown={e => e.preventDefault()}
          >
            <Save /> Save
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="font-medium cursor-pointer select-none">
                <Download /> Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleDownloadJSON}>Download as JSON</DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDownloadCSV}
                className="flex items-center justify-between gap-2"
              >
                <span>Download as CSV</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-accent"
                  onClick={e => {
                    e.stopPropagation();
                    handleShowCSVPreview();
                  }}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadPDF}>Download as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div>
            <ProfileMenu
              onSave={async () => {
                await handleSave();
              }}
            />
          </div>
        </div>

        {isEditDialogOpen && (
          <EditProjectDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSave={handleEditProject}
            initialName={project?.name || ''}
            isLoading={isSavingName}
          />
        )}

        <CSVPreviewDialog
          open={isCSVPreviewOpen}
          onOpenChange={setIsCSVPreviewOpen}
          data={csvPreviewData}
          onDownload={handleDownloadCSV}
          projectName={project?.name}
        />

        <DriverConstraintWarning
          open={isConstraintWarningOpen}
          onOpenChange={setIsConstraintWarningOpen}
          driversCount={constraintWarningData.driversCount}
          maxDriversPerEngine={constraintWarningData.maxDriversPerEngine}
          dimmingEngineCount={constraintWarningData.dimmingEngineCount}
        />

        <UnassignedFixturesError
          open={isUnassignedErrorOpen}
          onOpenChange={setIsUnassignedErrorOpen}
          unassignedCount={unassignedFixturesCount}
        />
      </header>
    </>
  );
};

export default DashboardHeader;
