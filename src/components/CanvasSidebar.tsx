'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCanvas } from '@/context/canvasContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import ObjectControlBar from './ObjectControlBar';
import {
  Trash2,
  Square,
  Circle,
  Type,
  Minus,
  Eye,
  Pencil,
  ChevronDown,
  ChevronRight,
  PanelLeftIcon,
  Plus,
  Layers,
  EyeOff,
} from 'lucide-react';
import * as fabric from 'fabric';
import { ComponentType } from '@/utils/enum';
// Fixtures selection dropdown UI imports
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Switch } from '@/components/ui/Switch';
import {
  Select as UiSelect,
  SelectContent as UiSelectContent,
  SelectItem as UiSelectItem,
  SelectTrigger as UiSelectTrigger,
  SelectValue as UiSelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { useFixtures } from '@/hooks/useFixtures';
import { useMixLibrary } from '@/hooks/useMixLibrary';
import { CanvasObject } from '@/types/interfaces';
import sidebar from '@/@data/sidebar';
import {
  isObjectInsidePolygon,
  isPointInPolygon,
  calculateOverlapArea,
} from '@/utils/fabric/canvasOperations';
import {
  allocateDrivers,
  type Driver,
  type LayerInfo,
} from '@/utils/dimmingEngine/allocateDrivers';

// Custom hook for sidebar state management
const useCanvasSidebar = () => {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleSidebar = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return {
    isExpanded,
    toggleSidebar,
  };
};

interface Point {
  x: number;
  y: number;
}

interface Layer {
  id: string;
  name: string;
  layerId: number;
  visible: boolean;
  objectIds: string[];
}

interface PolygonLayer {
  id: string;
  name: string;
  layerId: number;
  visible?: boolean; // persist visibility on the polygon itself
  objectIds: string[]; // Track which fixtures belong to this layer
}

interface Boundary {
  id: string;
  name: string;
  zone1Id: string;
  zone2Id: string;
  visible: boolean;
  position: number; // Position between zones (0 = before first zone, 1 = between zone 1&2, etc.)
  presenceSensorId?: string; // Single presence sensor per boundary
  manualAssociation?: boolean;
}

interface GroupedObject {
  id: string;
  type: string;
  name: string;
  roomName?: string;
  features?: string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  fontSize?: number;
  text?: string;
  visible: boolean;
  opacity: number;
  isPolygon: boolean;
  shapeId?: number;
  containedObjects?: GroupedObject[];
  layers?: Layer[];
}

const CanvasSidebar = () => {
  const { canvas } = useCanvas();
  const { isExpanded, toggleSidebar } = useCanvasSidebar();
  const { fixtures } = useFixtures();
  const { getMixesByLayerCount } = useMixLibrary();
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [groupedObjects, setGroupedObjects] = useState<GroupedObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<CanvasObject | null>(null);
  const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isMultipleSelection, setIsMultipleSelection] = useState<boolean>(false);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState<string>('');
  const [draggedObjectId, setDraggedObjectId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [boundaries, setBoundaries] = useState<Boundary[]>([]);
  const [draggedBoundaryId, setDraggedBoundaryId] = useState<string | null>(null);
  const [dragOverBoundaryPosition, setDragOverBoundaryPosition] = useState<number | null>(null);
  const [expandedBoundaryIds, setExpandedBoundaryIds] = useState<Set<string>>(new Set());
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);

  // Map to store original fills for zones during hover (not persisted to canvas)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zoneOriginalFillsRef = useRef<Map<string, any>>(new Map());

  // Local per-containedObject selection state (not persisted yet)
  const [objectModelMap, setObjectModelMap] = useState<Record<string, string>>({}); // key: contained.id, value: fixtureId
  // Zone-level custom properties state maps
  const [zoneMixMap, setZoneMixMap] = useState<Record<string, string>>({});
  const [zoneSightLineMap, setZoneSightLineMap] = useState<Record<string, number>>({});
  const [zoneBrightnessScaleMap, setZoneBrightnessScaleMap] = useState<Record<string, number>>({});
  const [zoneSightLineEnabledMap, setZoneSightLineEnabledMap] = useState<Record<string, boolean>>(
    {}
  );
  const [zoneSightLinePrevMap, setZoneSightLinePrevMap] = useState<Record<string, number>>({});
  const [objectNightlightMap, setObjectNightlightMap] = useState<Record<string, boolean>>({});
  const [objectNightlightValueMap, setObjectNightlightValueMap] = useState<Record<string, number>>(
    {}
  );

  // Fixture model memory: stores the last used model for each fixture type
  // Key: fixture type (e.g., "Recessed"), Value: {modelName: string, layerId: string}
  const [fixtureModelMemory, setFixtureModelMemory] = useState<
    Record<string, { modelName: string; layerId: string }>
  >({});

  // Debounce refs to prevent canvas freezing
  const updateObjectsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconstructTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const boundariesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize zone property maps from canvas whenever canvas or groupedObjects change
  useEffect(() => {
    if (!canvas) return;

    const polygons = canvas.getObjects().filter(obj => obj.type === 'polygon');
    const newMixMap: Record<string, string> = {};
    const newSightLineMap: Record<string, number> = {};
    const newSightLineEnabledMap: Record<string, boolean> = {};
    const newBrightnessScaleMap: Record<string, number> = {};

    polygons.forEach(poly => {
      const id = poly.get('id') as string;
      if (!id) return;

      // Initialize mix from canvas polygon
      const mix = (poly.get('mix') as string) || '';
      if (mix) newMixMap[id] = mix;

      // Initialize sight line from canvas polygon
      const sightLine = (poly.get('sightLine') as number) ?? 0;
      if (sightLine > 0) {
        newSightLineMap[id] = sightLine;
        newSightLineEnabledMap[id] = true;
      } else {
        newSightLineEnabledMap[id] = false;
      }

      // Initialize brightness scale from canvas polygon
      const brightnessScale = (poly.get('brightnessScale') as number) ?? 1;
      newBrightnessScaleMap[id] = brightnessScale;
    });

    // Only update state if values have changed to avoid unnecessary re-renders
    setZoneMixMap(prev => (JSON.stringify(prev) !== JSON.stringify(newMixMap) ? newMixMap : prev));
    setZoneSightLineMap(prev =>
      JSON.stringify(prev) !== JSON.stringify(newSightLineMap) ? newSightLineMap : prev
    );
    setZoneSightLineEnabledMap(prev =>
      JSON.stringify(prev) !== JSON.stringify(newSightLineEnabledMap)
        ? newSightLineEnabledMap
        : prev
    );
    setZoneBrightnessScaleMap(prev =>
      JSON.stringify(prev) !== JSON.stringify(newBrightnessScaleMap) ? newBrightnessScaleMap : prev
    );
  }, [canvas, groupedObjects]);

  // Initialize nightlight maps from canvas whenever canvas or groupedObjects change
  useEffect(() => {
    if (!canvas) return;

    const allObjects = canvas.getObjects().filter(obj => obj.type !== 'image' && obj.get('id'));
    const newNightlightMap: Record<string, boolean> = {};
    const newNightlightValueMap: Record<string, number> = {};

    allObjects.forEach(obj => {
      const id = obj.get('id') as string;
      if (!id) return;

      // Initialize nightlight from canvas object
      const nightLight = (obj.get('nightLight') as number) ?? 0;
      newNightlightMap[id] = nightLight > 0;
      newNightlightValueMap[id] = nightLight > 0 ? nightLight : 0.5;
    });

    // Only update state if values have changed to avoid unnecessary re-renders
    setObjectNightlightMap(prev =>
      JSON.stringify(prev) !== JSON.stringify(newNightlightMap) ? newNightlightMap : prev
    );
    setObjectNightlightValueMap(prev =>
      JSON.stringify(prev) !== JSON.stringify(newNightlightValueMap) ? newNightlightValueMap : prev
    );
  }, [canvas, groupedObjects]);

  const getFixturesForShape = useCallback(
    (shapeId?: number) =>
      (fixtures || []).filter(
        f => (f as unknown as { sidebarId?: number | null }).sidebarId === shapeId
      ),
    [fixtures]
  );

  /**
   * Generates driver allocation data across all zones (canvas-wide)
   * Only called if dimming engines exist (user has placed them on canvas)
   * Fixtures from multiple zones can share drivers
   * This should be called during project export to populate the drivers array
   * Usage: const driversData = generateDriversDataForZones();
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const generateDriversDataForZones = useCallback((): {
    drivers: Driver[];
    warnings: string[];
  } | null => {
    if (!canvas) return null;

    // Check if any dimming engines exist on canvas
    // Dimming engines have shapeId: 7
    const dimmingEngines = canvas.getObjects().filter(obj => {
      return obj.get('shapeId') === 7;
    });

    // If no dimming engines, don't calculate drivers
    if (dimmingEngines.length === 0) {
      return null;
    }

    const allLayers: LayerInfo[] = [];
    const allWarnings: string[] = [];

    // Collect layers from ALL zones
    for (const zone of groupedObjects.filter(obj => obj.isPolygon)) {
      if (!zone.layers || zone.layers.length === 0) continue;

      const layers: LayerInfo[] = zone.layers
        .map(layer => {
          const fixtures =
            zone.containedObjects
              ?.filter(obj => layer.objectIds.includes(obj.id))
              .map(obj => ({
                id: obj.id,
                channelCount:
                  canvas
                    .getObjects()
                    .find(canvasObj => canvasObj.get('id') === obj.id)
                    ?.get('channelCount') || 3,
                wattPower:
                  canvas
                    .getObjects()
                    .find(canvasObj => canvasObj.get('id') === obj.id)
                    ?.get('wattPower') || 0,
              })) || [];

          return {
            layerId: layer.id,
            zoneId: zone.id,
            mixId: zoneMixMap[zone.id] || '',
            fixtures,
          };
        })
        .filter(l => l.fixtures.length > 0);

      allLayers.push(...layers);
    }

    // Allocate all fixtures across drivers (global allocation, not per-zone)
    if (allLayers.length > 0) {
      const { drivers, warnings } = allocateDrivers(allLayers);
      allWarnings.push(...warnings);
      return {
        drivers,
        warnings: allWarnings,
      };
    }

    return null;
  }, [canvas, groupedObjects, zoneMixMap]);

  const toggleBoundaryOptions = (boundaryId: string) => {
    setExpandedBoundaryIds(prev => {
      const next = new Set(prev);
      if (next.has(boundaryId)) next.delete(boundaryId);
      else next.add(boundaryId);
      return next;
    });
  };

  // Handle zone hover to highlight polygon on canvas
  const handleZoneHover = (zoneId: string | null) => {
    if (!canvas) return;

    if (zoneId) {
      // Find the polygon object on canvas
      const polygon = canvas
        .getObjects()
        .find(obj => obj.get('id') === zoneId && obj.type === 'polygon');
      if (polygon) {
        // Store original fill and visibility in ref map (not on the object to avoid persistence)
        const currentFill = polygon.fill;
        const currentVisibility = polygon.visible;
        if (!zoneOriginalFillsRef.current.has(zoneId)) {
          zoneOriginalFillsRef.current.set(zoneId, {
            fill: currentFill,
            visible: currentVisibility,
          });
        }
        // Add highlight effect and make visible even if geometry is hidden
        polygon.set({
          fill: 'rgba(59, 130, 246, 0.3)', // Blue highlight with transparency
          dirty: true,
          visible: true, // Ensure polygon is visible when hovering
        });
        canvas.requestRenderAll();
      }
      setHoveredZoneId(zoneId);
    } else {
      // Restore original appearance when hover ends
      if (hoveredZoneId) {
        const polygon = canvas
          .getObjects()
          .find(obj => obj.get('id') === hoveredZoneId && obj.type === 'polygon');
        if (polygon) {
          // Get the original fill and visibility from ref map
          const originalState = zoneOriginalFillsRef.current.get(hoveredZoneId);
          if (originalState !== undefined) {
            polygon.set({
              fill: originalState.fill,
              visible: originalState.visible,
              dirty: true,
            });
            // Clean up ref map
            zoneOriginalFillsRef.current.delete(hoveredZoneId);
          }
          canvas.requestRenderAll();
        }
      }
      setHoveredZoneId(null);
    }
  };

  const handleBoundaryCardClick = (e: React.MouseEvent, boundaryId: string) => {
    // Check if the click is on an interactive element (select, button, etc.)
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'SELECT' ||
      target.tagName === 'BUTTON' ||
      target.closest('select, button')
    ) {
      e.stopPropagation();
      return;
    }

    // Otherwise, handle the normal click
    if (!isExpanded) {
      toggleSidebar();
      setTimeout(() => selectBoundary(boundaryId), 200);
    } else {
      toggleBoundaryOptions(boundaryId);
    }
  };

  const objectsRef = useRef<CanvasObject[]>([]);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Helper function to check if object is a switch component
  const isSwitchObject = (obj: fabric.Object): boolean => {
    const category = obj.get('shapeCategory') as ComponentType;
    return category === ComponentType.Switch;
  };

  // Helper function to check if object is a boundary line
  const isBoundaryObject = (obj: fabric.Object): boolean => {
    const category = obj.get('shapeCategory') as ComponentType;
    return category === ComponentType.Shape && obj.type === 'line';
  };

  // Helper function to get boundary name
  const getBoundaryName = (obj: fabric.Object): string => {
    return obj.get('name') || 'Boundary';
  };

  // Update grouped objects whenever objects change
  useEffect(() => {
    if (objects.length > 0) {
      const updatedGrouped = reconstructLayersFromObjects(objects);
      setGroupedObjects(updatedGrouped);
    }
  }, [objects]);

  // Keep objectsRef.current synchronized with objects state
  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  // Initialize boundaries when canvas is first loaded
  useEffect(() => {
    if (canvas && boundaries.length === 0 && groupedObjects.length > 0) {
      // Add a small delay to ensure grouped objects are fully set
      const timer = setTimeout(() => {
        initializeBoundaries();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [canvas, groupedObjects.length]);

  // Update boundaries when canvas objects change
  useEffect(() => {
    if (canvas && groupedObjects.length > 0) {
      const boundaryObjects = canvas.getObjects().filter(obj => isBoundaryObject(obj));
      const existingBoundaryIds = new Set(boundaries.map(b => b.id));
      const newBoundaries = boundaryObjects.filter(obj => !existingBoundaryIds.has(obj.get('id')));

      if (newBoundaries.length > 0) {
        // Use initializeBoundaries to properly load all boundaries with their data
        initializeBoundaries();
      }
    }
  }, [canvas, objects.length]);

  // Function to scroll to a specific object
  const scrollToObject = (objectId: string) => {
    if (!sidebarRef.current) return;

    const objectElement = sidebarRef.current.querySelector(
      `[data-object-id="${objectId}"]`
    ) as HTMLElement;

    if (objectElement) {
      objectElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  };

  // Function to expand only one object at a time
  const expandSingleObject = (objectId: string) => {
    setExpandedObjects(new Set([objectId]));

    // If this is a contained object, also expand its parent polygon and layer
    let currentGroupedObjects = groupedObjects;

    // If groupedObjects is empty, we need to create them temporarily
    if (groupedObjects.length === 0 && canvas) {
      const canvasObjects = canvas
        .getObjects()
        .filter(obj => obj.type !== 'image' && obj.get('id'));
      const nameCounts: Record<string, number> = {};
      const tempObjects: CanvasObject[] = canvasObjects.map(obj => {
        const baseName = getObjectName(obj);
        nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
        const finalName =
          obj.type === 'polygon'
            ? nameCounts[baseName] === 1
              ? baseName
              : `${baseName} ${nameCounts[baseName] - 1}`
            : `${baseName} ${nameCounts[baseName]}`;

        let overlayColor = typeof obj.fill === 'string' ? obj.fill : '#000000';
        let overlayOpacity = obj.get('opacity') || 1;

        if (obj.type === 'group' && 'getObjects' in obj) {
          const group = obj as fabric.Group;
          const overlayItem = group.getObjects().find(child => {
            const category = child.get('shapeCategory') as ComponentType;
            return category === ComponentType.Overlay && child.visible !== false;
          });

          if (overlayItem) {
            overlayColor = typeof overlayItem.fill === 'string' ? overlayItem.fill : '#000000';
            overlayOpacity = overlayItem.opacity || 1;
          }
        }

        return {
          id: obj.get('id'),
          type: obj.type || 'unknown',
          name: finalName || obj.get('name'),
          color: overlayColor,
          strokeColor: typeof obj.stroke === 'string' ? obj.stroke : '#000000',
          strokeWidth: obj.strokeWidth || 1,
          width: obj.width,
          height: obj.height,
          left: obj.left,
          top: obj.top,
          angle: obj.angle,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          fontSize: obj.get('fontSize'),
          text: obj.get('text'),
          visible: obj.visible,
          opacity: overlayOpacity,
          shapeId: obj.get('shapeId'),
        };
      });

      currentGroupedObjects = reconstructLayersFromObjects(tempObjects);
    }

    const containingPolygon = currentGroupedObjects.find(
      group =>
        group.isPolygon &&
        group.containedObjects &&
        group.containedObjects.some(obj => obj.id === objectId)
    );

    if (containingPolygon) {
      // Expand the parent polygon
      setExpandedGroups(prev => {
        const newSet = new Set(prev);
        newSet.add(containingPolygon.id);
        return newSet;
      });

      // Find and expand the layer containing this object
      if (containingPolygon.layers) {
        const containingLayer = containingPolygon.layers.find(layer =>
          layer.objectIds.includes(objectId)
        );

        if (containingLayer) {
          setExpandedLayers(prev => {
            const newSet = new Set(prev);
            newSet.add(containingLayer.id);
            return newSet;
          });
        }
      }
    }
  };

  // Function to toggle group expansion
  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Layer management functions (default layer creation removed; layers are created on demand)

  // Function to assign object to a layer (stores on fabric object)
  const assignObjectToLayer = (
    objectId: string,
    layerId: string,
    polygonId: string,
    layerName: string
  ) => {
    if (!canvas) return;
    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
    if (obj) {
      // Get the polygon object to access its layer info
      const polygonObj = canvas.getObjects().find(p => p.get('id') === polygonId);
      const polygonLayers = polygonObj?.get('layers') || [];
      const polygonLayer = polygonLayers.find((pl: PolygonLayer) => pl.id === layerId);

      const componentNumber = getGlobalComponentNumber(
        obj.get('shapeId'),
        polygonId,
        layerId,
        true
      );
      obj.set({
        layerId: layerId,
        layerName: layerName,
        polygonId: polygonId,
        zoneUuid: polygonId, // Zone UUID ID
        layerUuid: layerId, // Layer UUID ID
        sequentialLayerId: polygonLayer?.layerId || 1, // Sequential layer ID
        componentNumber: componentNumber, // Global component number
        // If moving into a visible layer, ensure the object becomes visible
        visible: polygonLayer?.visible !== false,
      });

      // If the object is a group, propagate visibility to children for consistent style
      if (obj.type === 'group' && 'getObjects' in obj) {
        const groupObj = obj as fabric.Group;
        const makeVisible = polygonLayer?.visible !== false;
        groupObj.getObjects().forEach(child => child.set('visible', makeVisible));
      }

      // Update exportId with component number
      updateExportIdWithComponentNumber(obj, componentNumber);

      // Fill gaps in component numbering after moving
      fillComponentNumberGaps();

      canvas.requestRenderAll();
    }
  };

  // Function to get object's current layer info
  const getObjectLayerInfo = (
    objectId: string
  ): { layerId: string; layerName: string; polygonId: string } | null => {
    if (!canvas) return null;
    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
    if (obj) {
      return {
        layerId: obj.get('layerId') || '',
        layerName: obj.get('layerName') || '',
        polygonId: obj.get('polygonId') || '',
      };
    }
    return null;
  };

  // Update reconstructLayersFromObjects to not create a default layer if any exist
  const reconstructLayersFromObjects = (canvasObjects: CanvasObject[]): GroupedObject[] => {
    if (!canvas) return [];
    const allObjects: fabric.Object[] = canvas.getObjects();
    const polygons: fabric.Polygon[] = allObjects.filter(
      obj => obj.type === 'polygon'
    ) as fabric.Polygon[];
    const groupedObjects: GroupedObject[] = [];
    const processedObjects = new Set<string>();

    // Process polygons first
    polygons.forEach((polygon: fabric.Polygon) => {
      const polygonId = polygon.get('id');
      const polygonObj = canvasObjects.find(obj => obj.id === polygonId);
      if (polygonObj) {
        // Read layers directly from the polygon's layers array
        const polygonLayers = polygon.get('layers') || [];

        // Convert polygon layers to sidebar Layer format
        const layers: Layer[] = polygonLayers.map((polygonLayer: PolygonLayer) => ({
          id: polygonLayer.id,
          name: polygonLayer.name,
          layerId: polygonLayer.layerId,
          visible: polygonLayer.visible !== false,
          objectIds: polygonLayer.objectIds || [], // Read objectIds from polygon
        }));

        // Do not auto-create a default layer; allow zones to have zero layers until needed

        console.log('🎯 Creating grouped object with features:', {
          id: polygonId,
          name: polygonObj.name,
          roomName: polygonObj.roomName,
          features: polygonObj.features,
        });

        groupedObjects.push({
          ...polygonObj,
          roomName: polygonObj.roomName,
          features: polygonObj.features,
          strokeColor: polygonObj.strokeColor || '#000000',
          strokeWidth: polygonObj.strokeWidth || 1,
          visible: polygonObj.visible !== false,
          opacity: polygonObj.opacity || 1,
          isPolygon: true,
          shapeId: polygonObj.shapeId,
          containedObjects: [],
          layers,
        });
        processedObjects.add(polygonId);
      }
    });

    // Process other objects
    canvasObjects.forEach(obj => {
      if (obj.type === 'polygon' || processedObjects.has(obj.id)) return;
      const fabricObj = allObjects.find(fObj => fObj.get('id') === obj.id);
      if (!fabricObj) return;

      // Skip boundary objects - they should not be placed inside zones
      if (isBoundaryObject(fabricObj)) {
        processedObjects.add(obj.id);
        return;
      }

      const containingPolygon = polygons.find(polygon => isObjectInsidePolygon(fabricObj, polygon));
      if (containingPolygon) {
        const polygonId = containingPolygon.get('id');
        const polygonGroup = groupedObjects.find(g => g.id === polygonId);
        if (polygonGroup) {
          // Auto-apply remembered model if this fixture type has one
          const fixtureType = (fabricObj?.get('shapeType') as string) || '';
          const currentModelName = (fabricObj?.get('modelName') as string) || '';
          const rememberedModel = fixtureModelMemory[fixtureType];

          if (!currentModelName && rememberedModel && rememberedModel.modelName) {
            // Fixture has no model yet, but we have a remembered one for this type
            // Find the fixture data to get all model details
            const modelFixture = (fixtures || []).find(
              f => f.modelName === rememberedModel.modelName
            );

            if (modelFixture) {
              // Apply all model details to the fabric object
              fabricObj.set({
                modelId: modelFixture.id,
                modelName: modelFixture.modelName,
                manufacturer: modelFixture.manufacturer,
                lumens: modelFixture.lumens ?? null,
                sizeIn: modelFixture.sizeIn ?? null,
                unitPrice: modelFixture.price ?? null,
                channelCount: modelFixture.channelCount ?? null,
                wattPower: modelFixture.peakPowerW ?? null,
              });
            }
          }

          // Add to contained objects
          polygonGroup.containedObjects!.push({
            ...obj,
            strokeColor: obj.strokeColor || '#000000',
            strokeWidth: obj.strokeWidth || 1,
            visible: obj.visible !== false,
            opacity: obj.opacity || 1,
            isPolygon: false,
            shapeId: obj.shapeId,
          });

          // Add zone UUID to switch components (they don't get layer assignments)
          if (isSwitchObject(fabricObj)) {
            if (fabricObj) {
              const componentNumber = getGlobalComponentNumber(
                obj.shapeId!,
                polygonId,
                undefined,
                true
              );
              fabricObj.set({
                polygonId: polygonId,
                zoneUuid: polygonId, // Zone UUID ID for switch components
                componentNumber: componentNumber, // Global component number
              });

              // Update exportId with component number
              updateExportIdWithComponentNumber(fabricObj, componentNumber);
            }
          }
          // Only assign to layers if it's not a text object and not a switch component
          else if (!isTextObject(obj) && !isBoundaryObject(fabricObj) && polygonGroup.layers) {
            // Check if object has existing layer info
            const existingLayerInfo = getObjectLayerInfo(obj.id);
            let targetLayer: Layer | undefined;

            if (existingLayerInfo && existingLayerInfo.polygonId === polygonId) {
              // Object already has layer info, but we group by model. Keep the existing layer
              // only if its name matches the object's current modelName. If model is unset,
              // only keep the layer if it's the Unassigned layer.
              const candidate = polygonGroup.layers.find(
                layer => layer.id === existingLayerInfo.layerId
              );
              const currentModelName = (fabricObj?.get('modelName') as string) || '';
              const UNASSIGNED_LAYER_NAME = 'Unassigned';
              if (
                candidate &&
                ((currentModelName === '' && candidate.name === UNASSIGNED_LAYER_NAME) ||
                  (currentModelName !== '' && candidate.name === currentModelName))
              ) {
                targetLayer = candidate;
              } else {
                // Model changed - need to remove from old layer and add to new layer
                // This removal will cause the old layer to become empty if it was the last fixture
                // Empty layers are automatically removed later in the reconstruction process
                targetLayer = undefined; // force regrouping below by model name/unassigned

                // Remove from old layer's objectIds (this may make the layer empty)
                const oldLayer = polygonGroup.layers.find(l => l.id === existingLayerInfo.layerId);
                if (oldLayer && oldLayer.objectIds.includes(obj.id)) {
                  oldLayer.objectIds = oldLayer.objectIds.filter(id => id !== obj.id);
                }
              }
            }

            // Enforce: one model (modelName) per layer. Lights without a model go to 'Unassigned'.
            if (!targetLayer) {
              const objModelName = (fabricObj?.get('modelName') as string) || '';
              const UNASSIGNED_LAYER_NAME = 'Unassigned';

              // Try to find a layer containing an object with the same modelName
              const findLayerWithModel = (
                layers: Layer[],
                modelName: string
              ): Layer | undefined => {
                if (!modelName) return undefined;
                for (const layer of layers) {
                  const hasSameModel = layer.objectIds.some(id => {
                    const o = canvas?.getObjects().find(x => x.get('id') === id);
                    return (o?.get('modelName') as string) === modelName;
                  });
                  if (hasSameModel) return layer;
                }
                // Also allow matching by layer name if it equals the model name
                return layers.find(l => l.name === modelName);
              };

              // Handle unassigned (no model) first
              if (!objModelName) {
                // Find existing 'Unassigned' layer
                const unassignedExisting = polygonGroup.layers.find(
                  l => l.name === UNASSIGNED_LAYER_NAME
                );
                if (unassignedExisting) {
                  targetLayer = unassignedExisting;
                } else {
                  // Try first empty and rename it to Unassigned
                  const emptyLayer = polygonGroup.layers.find(
                    l => (l.objectIds?.length || 0) === 0
                  );
                  if (emptyLayer) {
                    const polygonObj = canvas?.getObjects().find(p => p.get('id') === polygonId) as
                      | fabric.Polygon
                      | undefined;
                    if (polygonObj) {
                      const currentLayers = (polygonObj.get('layers') || []) as PolygonLayer[];
                      const renamed = currentLayers.map(pl =>
                        pl.id === emptyLayer.id ? { ...pl, name: UNASSIGNED_LAYER_NAME } : pl
                      );
                      polygonObj.set('layers', renamed);
                      canvas?.requestRenderAll();
                    }
                    emptyLayer.name = UNASSIGNED_LAYER_NAME;
                    targetLayer = emptyLayer;
                  }
                }
              } else {
                targetLayer = findLayerWithModel(polygonGroup.layers, objModelName);
              }

              // If none found yet, try first empty layer; rename according to state
              if (!targetLayer) {
                const emptyLayer = polygonGroup.layers.find(l => (l.objectIds?.length || 0) === 0);
                if (emptyLayer) {
                  const newName = objModelName || UNASSIGNED_LAYER_NAME;
                  const polygonObj = canvas?.getObjects().find(p => p.get('id') === polygonId) as
                    | fabric.Polygon
                    | undefined;
                  if (polygonObj) {
                    const currentLayers = (polygonObj.get('layers') || []) as PolygonLayer[];
                    const renamed = currentLayers.map(pl =>
                      pl.id === emptyLayer.id ? { ...pl, name: newName } : pl
                    );
                    polygonObj.set('layers', renamed);
                    canvas?.requestRenderAll();
                  }
                  emptyLayer.name = newName;
                  targetLayer = emptyLayer;
                }
              }

              if (!targetLayer) {
                // Create new layer on the polygon for this model
                const polygonObj = canvas?.getObjects().find(p => p.get('id') === polygonId) as
                  | fabric.Polygon
                  | undefined;
                const currentLayers = (polygonObj?.get('layers') || []) as PolygonLayer[];
                const maxLayerId =
                  currentLayers.length > 0
                    ? Math.max(...currentLayers.map(l => l.layerId || 1))
                    : 0;
                const newLayerId = maxLayerId + 1;
                const newLayerName = objModelName || UNASSIGNED_LAYER_NAME || `Layer ${newLayerId}`;
                const newLayer: PolygonLayer = {
                  id: crypto.randomUUID(),
                  layerId: newLayerId,
                  name: newLayerName,
                  visible: true,
                  objectIds: [], // Initialize empty objectIds array
                };
                const updatedPolygonLayers = [...currentLayers, newLayer];
                polygonObj?.set('layers', updatedPolygonLayers);
                canvas?.requestRenderAll();

                // Reflect in sidebar group state
                const sidebarLayer: Layer = {
                  id: newLayer.id,
                  name: newLayerName,
                  visible: true,
                  layerId: newLayer.layerId,
                  objectIds: [],
                };
                polygonGroup.layers.push(sidebarLayer);
                targetLayer = sidebarLayer;
              }

              if (targetLayer && fabricObj) {
                const polygonObj = canvas?.getObjects().find(p => p.get('id') === polygonId) as
                  | fabric.Polygon
                  | undefined;
                const polygonLayers = (polygonObj?.get('layers') || []) as PolygonLayer[];
                const polygonLayer = polygonLayers.find(pl => pl.id === targetLayer!.id);

                const componentNumber = getGlobalComponentNumber(
                  obj.shapeId!,
                  polygonId,
                  targetLayer.id,
                  true
                );
                fabricObj.set({
                  layerId: targetLayer.id,
                  layerName: targetLayer.name,
                  polygonId: polygonId,
                  layerExportId: `L${polygonLayer?.layerId || 1}`,
                  zoneUuid: polygonId,
                  layerUuid: targetLayer.id,
                  sequentialLayerId: polygonLayer?.layerId || 1,
                  componentNumber: componentNumber,
                });
                updateExportIdWithComponentNumber(fabricObj, componentNumber);
              }
            }

            if (targetLayer) {
              // Only add if not already present (prevent duplicates)
              if (!targetLayer.objectIds.includes(obj.id)) {
                targetLayer.objectIds.push(obj.id);
              }
            }
          }
        }
      } else {
        // Object is outside all polygons - add it as a standalone object
        groupedObjects.push({
          ...obj,
          strokeColor: obj.strokeColor || '#000000',
          strokeWidth: obj.strokeWidth || 1,
          visible: obj.visible !== false,
          opacity: obj.opacity || 1,
          isPolygon: false,
          shapeId: obj.shapeId,
          containedObjects: [],
        });
        processedObjects.add(obj.id);
      }
    });

    // After assigning objects to layers, prune any empty layers and update sequencing/export IDs
    const removedLayerIds: string[] = [];
    groupedObjects.forEach(group => {
      if (!group.isPolygon || !group.layers) return;
      const polygonId = group.id;
      const polygonObj = canvas.getObjects().find(o => o.get('id') === polygonId) as
        | fabric.Polygon
        | undefined;
      const currentPolyLayers: PolygonLayer[] = (polygonObj?.get('layers') || []) as PolygonLayer[];

      // Auto-remove empty layers (e.g., when all fixtures moved to other layers or models changed)
      // This includes the "Unassigned" layer when all fixtures get assigned models
      const keptLayers = (group.layers || []).filter(l => (l.objectIds?.length || 0) > 0);
      const deleted = (group.layers || [])
        .filter(l => (l.objectIds?.length || 0) === 0)
        .map(l => l.id);
      removedLayerIds.push(...deleted);

      // Update polygon layers WITHOUT changing layerId or layer names
      const newPolyLayers: PolygonLayer[] = keptLayers.map(l => {
        const existing = currentPolyLayers.find(pl => pl.id === l.id);
        // Keep the original layerId from the existing polygon layer
        const originalLayerId = existing?.layerId ?? 1;

        // Update objects in this layer with export IDs
        l.objectIds.forEach(objectId => {
          const obj = canvas.getObjects().find(o => o.get('id') === objectId);
          if (obj) {
            obj.set('layerExportId', `L${originalLayerId}`);
            obj.set('sequentialLayerId', originalLayerId);
          }
        });

        return {
          id: l.id,
          layerId: originalLayerId, // Keep original layerId - don't reassign
          name: l.name, // Keep the layer name from sidebar (model name)
          visible: l.visible !== false,
          objectIds: l.objectIds || [], // Persist objectIds to polygon
        } as PolygonLayer;
      });

      // Persist updated polygon layers and sidebar layers
      polygonObj?.set('layers', newPolyLayers);
      group.layers = keptLayers;
    });

    // Remove any deleted layer IDs from the expanded set
    if (removedLayerIds.length > 0) {
      setExpandedLayers(prev => {
        const next = new Set(prev);
        removedLayerIds.forEach(id => next.delete(id));
        return next;
      });
    }

    // Fill gaps in component numbering after reconstruction
    fillComponentNumberGaps();

    return groupedObjects;
  };

  const addLayer = (polygonId: string) => {
    if (!canvas) return;

    // Find the polygon object on the canvas
    const polygonObj = canvas.getObjects().find(obj => obj.get('id') === polygonId);
    if (!polygonObj || !(polygonObj instanceof fabric.Polygon)) return;

    // Get the current layers from the polygon
    const currentLayers = polygonObj.get('layers') || [];

    // Find the highest layerId to increment from
    const maxLayerId =
      currentLayers.length > 0
        ? Math.max(...currentLayers.map((layer: PolygonLayer) => layer.layerId || 1))
        : 0;

    const newLayerId = maxLayerId + 1;
    const newLayerName = `Layer ${newLayerId}`;
    const newLayer: PolygonLayer = {
      id: crypto.randomUUID(),
      layerId: newLayerId,
      name: newLayerName,
      visible: true,
      objectIds: [], // Initialize empty objectIds array
    };

    // Add the new layer to the polygon's layers array
    const updatedLayers = [...currentLayers, newLayer];
    polygonObj.set('layers', updatedLayers);

    // Reset the mix since layer count has changed
    polygonObj.set('mix', '');
    setZoneMixMap(prev => {
      const newMap = { ...prev };
      delete newMap[polygonId];
      return newMap;
    });

    // Debounce ALL state updates to prevent canvas freezing
    if (reconstructTimeoutRef.current) {
      clearTimeout(reconstructTimeoutRef.current);
    }
    reconstructTimeoutRef.current = setTimeout(() => {
      // Update the grouped objects state to reflect the new layer
      setGroupedObjects(prev => {
        return prev.map(group => {
          if (group.id === polygonId && group.isPolygon) {
            const existingLayers = group.layers || [];

            // Create the new layer for the sidebar
            const newSidebarLayer: Layer = {
              id: newLayer.id,
              name: newLayerName,
              visible: true,
              layerId: newLayer.layerId,
              objectIds: [],
            };

            // Update export IDs for all existing layers to ensure proper ordering
            const updatedLayers = existingLayers.map((layer, index) => ({
              ...layer,
              // Ensure layer export IDs are correct
              objectIds: layer.objectIds.map(objectId => {
                const obj = canvas?.getObjects().find(o => o.get('id') === objectId);
                if (obj) {
                  const newExportId = `L${index + 1}`;
                  obj.set('layerExportId', newExportId);
                }
                return objectId;
              }),
            }));

            return {
              ...group,
              layers: [...updatedLayers, newSidebarLayer],
            };
          }
          return group;
        });
      });

      canvas.requestRenderAll();
      // Regenerate export IDs to ensure consistency after a small delay
      setTimeout(() => generateAndStoreExportIds(), 50);
    }, 50);
  };

  const deleteLayer = (polygonId: string, layerId: string) => {
    if (!canvas) return;

    // Find the polygon object on the canvas
    const polygonObj = canvas.getObjects().find(obj => obj.get('id') === polygonId);
    if (!polygonObj || !(polygonObj instanceof fabric.Polygon)) return;

    // Get the current layers from the polygon
    const currentLayers = polygonObj.get('layers') || [];
    const layerToDelete = currentLayers.find((layer: PolygonLayer) => layer.id === layerId);

    // Prevent deletion of the last layer
    if (currentLayers.length <= 1) {
      return;
    }

    if (layerToDelete) {
      // Remove the layer from the polygon's layers array
      const updatedLayers = currentLayers.filter((layer: PolygonLayer) => layer.id !== layerId);

      // Keep original layerId and name - don't reassign or rename
      // This preserves model names and prevents "Layer 1, Layer 2" renaming

      // Update the polygon's layers
      polygonObj.set('layers', updatedLayers);

      // Reset the mix since layer count has changed
      polygonObj.set('mix', '');
      setZoneMixMap(prev => {
        const newMap = { ...prev };
        delete newMap[polygonId];
        return newMap;
      });
      canvas.requestRenderAll();

      // Update objects that were in the deleted layer
      const allObjects = canvas.getObjects();
      allObjects.forEach(obj => {
        if (obj.get('polygonId') === polygonId && obj.get('layerId') === layerToDelete.layerId) {
          // Clear layer information for objects in the deleted layer
          obj.set({
            layerId: null,
            layerName: null,
            polygonId: null,
            layerExportId: null,
          });
        }
      });

      setGroupedObjects(prev => {
        return prev.map(group => {
          if (group.id === polygonId && group.isPolygon && group.layers) {
            const layerToDeleteSidebar = group.layers.find(layer => layer.id === layerId);
            if (layerToDeleteSidebar) {
              // Delete all objects in this layer from canvas
              layerToDeleteSidebar.objectIds.forEach(objectId => {
                const obj = canvas.getObjects().find(o => o.get('id') === objectId);
                if (obj) {
                  // Clear layer information before removing
                  obj.set({
                    layerId: null,
                    layerName: null,
                    polygonId: null,
                    layerExportId: null,
                  });
                  canvas.remove(obj);
                }
              });

              const updatedLayers = group.layers.filter(layer => layer.id !== layerId);

              // Keep original layer export IDs - use the layer's original layerId from polygon
              // Don't reassign based on array index to prevent renaming
              const polygonLayers = polygonObj.get('layers') as PolygonLayer[];
              updatedLayers.forEach(layer => {
                // Find the corresponding polygon layer to get the original layerId
                const polygonLayer = polygonLayers.find(pl => pl.id === layer.id);
                if (polygonLayer) {
                  const originalLayerExportId = `L${polygonLayer.layerId || 1}`;
                  // Update layer export ID on all objects in this layer using original layerId
                  layer.objectIds.forEach(objectId => {
                    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
                    if (obj) {
                      obj.set('layerExportId', originalLayerExportId);
                    }
                  });
                }
              });

              return {
                ...group,
                layers: updatedLayers,
              };
            }
          }
          return group;
        });
      });

      // Debounce the expensive reconstruction to prevent canvas freezing
      if (reconstructTimeoutRef.current) {
        clearTimeout(reconstructTimeoutRef.current);
      }
      reconstructTimeoutRef.current = setTimeout(() => {
        if (canvas) {
          const canvasObjects = canvas
            .getObjects()
            .filter(obj => obj.type !== 'image' && obj.get('id'));

          const nameCounts: Record<string, number> = {};
          const objectsList: CanvasObject[] = canvasObjects.map(obj => {
            const baseName = getObjectName(obj);
            nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
            const finalName =
              obj.type === 'polygon'
                ? nameCounts[baseName] === 1
                  ? baseName
                  : `${baseName} ${nameCounts[baseName] - 1}`
                : `${baseName} ${nameCounts[baseName]}`;

            let overlayColor = typeof obj.fill === 'string' ? obj.fill : '#000000';
            let overlayOpacity = obj.get('opacity') || 1;

            if (obj.type === 'group' && 'getObjects' in obj) {
              const group = obj as fabric.Group;
              const overlayItem = group.getObjects().find(child => {
                const category = child.get('shapeCategory') as ComponentType;
                return category === ComponentType.Overlay && child.visible !== false;
              });

              if (overlayItem) {
                overlayColor = typeof overlayItem.fill === 'string' ? overlayItem.fill : '#000000';
                overlayOpacity = overlayItem.opacity || 1;
              }
            }

            return {
              id: obj.get('id'),
              type: obj.type || 'unknown',
              name: finalName || obj.get('name'),
              roomName: obj.get('roomName'),
              features: obj.get('features'),
              color: overlayColor,
              strokeColor: typeof obj.stroke === 'string' ? obj.stroke : '#000000',
              strokeWidth: obj.strokeWidth || 1,
              width: obj.width,
              height: obj.height,
              left: obj.left,
              top: obj.top,
              angle: obj.angle,
              scaleX: obj.scaleX,
              scaleY: obj.scaleY,
              fontSize: obj.get('fontSize'),
              text: obj.get('text'),
              visible: obj.visible,
              opacity: overlayOpacity,
              shapeId: obj.get('shapeId'),
            };
          });

          const updatedGrouped = reconstructLayersFromObjects(objectsList);
          setGroupedObjects(updatedGrouped);

          // Render and regenerate IDs after reconstruction completes
          canvas.requestRenderAll();
          setTimeout(() => generateAndStoreExportIds(), 50);
        }
      }, 100);
    }
  };

  const toggleLayerVisibility = (polygonId: string, layerId: string) => {
    if (!canvas) return;

    // We'll persist to polygon layers after computing newVisible below

    setGroupedObjects(prev => {
      return prev.map(group => {
        if (group.id === polygonId && group.isPolygon && group.layers) {
          const updatedLayers = group.layers.map(layer => {
            if (layer.id === layerId) {
              const newVisible = !layer.visible;

              // Update visibility of all objects in this layer
              layer.objectIds.forEach(objectId => {
                const obj = canvas.getObjects().find(o => o.get('id') === objectId);
                if (obj) {
                  obj.set('visible', newVisible);
                  // Ensure grouped children reflect visibility to revert visual styles correctly
                  if (obj.type === 'group' && 'getObjects' in obj) {
                    const groupObj = obj as fabric.Group;
                    groupObj.getObjects().forEach(child => child.set('visible', newVisible));
                  }
                }
              });

              // Persist to polygon layers as well
              const poly = canvas.getObjects().find(o => o.get('id') === polygonId);
              if (poly && poly instanceof fabric.Polygon) {
                const polyLayers: PolygonLayer[] = poly.get('layers') || [];
                const newPolyLayers = polyLayers.map(l =>
                  l.id === layerId ? { ...l, visible: newVisible } : l
                );
                poly.set('layers', newPolyLayers);
                canvas.requestRenderAll();
              }

              return { ...layer, visible: newVisible };
            }
            return layer;
          });

          return {
            ...group,
            layers: updatedLayers,
          };
        }
        return group;
      });
    });

    canvas.requestRenderAll();
  };

  // Update renameLayer to update both layerName and layerId on all objects in that layer
  const renameLayer = (polygonId: string, layerId: string, newName: string) => {
    // Don't rename if the name is empty or the same
    if (!newName.trim() || newName.trim() === '') return;

    if (!canvas) return;

    // Find the polygon object on the canvas
    const polygonObj = canvas.getObjects().find(obj => obj.get('id') === polygonId);
    if (!polygonObj || !(polygonObj instanceof fabric.Polygon)) return;

    // Get the current layers from the polygon
    const currentLayers = polygonObj.get('layers') || [];

    // Update the layer in the polygon's layers array
    const updatedPolygonLayers = currentLayers.map((layer: PolygonLayer) => {
      if (layer.id === layerId) {
        return {
          ...layer,
          name: newName.trim(),
        };
      }
      return layer;
    });

    // Update the polygon's layers
    polygonObj.set('layers', updatedPolygonLayers);
    canvas.requestRenderAll();

    // Update objects that are in this layer
    const allObjects = canvas.getObjects();
    allObjects.forEach(obj => {
      if (obj.get('polygonId') === polygonId && obj.get('layerId') === layerId) {
        obj.set({
          layerName: newName.trim(),
        });
      }
    });

    setGroupedObjects(prev => {
      return prev.map(group => {
        if (group.id === polygonId && group.isPolygon && group.layers) {
          const updatedLayers = group.layers.map(layer => {
            if (layer.id === layerId) {
              // Update both layerName and layerId on all objects in this layer
              if (canvas) {
                layer.objectIds.forEach(objectId => {
                  const obj = canvas.getObjects().find(o => o.get('id') === objectId);
                  if (obj) {
                    obj.set({
                      layerName: newName.trim(),
                    });
                  }
                });
                canvas.requestRenderAll();
              }
              return { ...layer, name: newName.trim() };
            }
            return layer;
          });
          return {
            ...group,
            layers: updatedLayers,
          };
        }
        return group;
      });
    });
  };

  const moveObjectToLayer = (
    objectId: string,
    fromPolygonId: string,
    toPolygonId: string,
    toLayerId: string
  ) => {
    // Find the target layer name
    let layerName = '';
    setGroupedObjects(prev => {
      prev.forEach(group => {
        if (group.id === toPolygonId && group.isPolygon && group.layers) {
          const targetLayer = group.layers.find(layer => layer.id === toLayerId);
          if (targetLayer) {
            layerName = targetLayer.name;
          }
        }
      });
      return prev;
    });
    assignObjectToLayer(objectId, toLayerId, toPolygonId, layerName);
    setGroupedObjects(prev => {
      return prev.map(group => {
        if (group.id === fromPolygonId && group.isPolygon && group.layers) {
          // Handle both source and target in the same polygon
          if (fromPolygonId === toPolygonId) {
            const updatedLayers = group.layers.map(layer => {
              if (layer.id === toLayerId) {
                // Add object to target layer
                return {
                  ...layer,
                  objectIds: [...layer.objectIds, objectId],
                };
              } else {
                // Remove object from all other layers
                return {
                  ...layer,
                  objectIds: layer.objectIds.filter(id => id !== objectId),
                };
              }
            });

            return {
              ...group,
              layers: updatedLayers,
            };
          } else {
            // Remove object from all layers in source polygon
            const updatedLayers = group.layers.map(layer => ({
              ...layer,
              objectIds: layer.objectIds.filter(id => id !== objectId),
            }));

            return {
              ...group,
              layers: updatedLayers,
            };
          }
        }

        if (
          group.id === toPolygonId &&
          group.isPolygon &&
          group.layers &&
          fromPolygonId !== toPolygonId
        ) {
          // Add object to target layer (only if moving between different polygons)
          const updatedLayers = group.layers.map(layer => {
            if (layer.id === toLayerId) {
              return {
                ...layer,
                objectIds: [...layer.objectIds, objectId],
              };
            }
            return layer;
          });

          return {
            ...group,
            layers: updatedLayers,
          };
        }

        return group;
      });
    });
  };

  const toggleLayerExpansion = (layerId: string) => {
    setExpandedLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layerId)) {
        newSet.delete(layerId);
      } else {
        newSet.add(layerId);
      }
      return newSet;
    });
  };

  // Boundary management functions
  const initializeBoundaries = () => {
    if (!canvas) return;

    const boundaryObjects = canvas.getObjects().filter(obj => isBoundaryObject(obj));
    const zoneObjects = groupedObjects.filter(group => group.isPolygon);

    // Load all boundaries from fabric objects, including existing ones
    const allBoundaries = boundaryObjects.map((obj, index) => {
      const boundaryId = obj.get('id');

      // Try to load existing boundary data from the fabric object
      let position = obj.get('boundaryPosition');
      let zone1Id = obj.get('zone1Id') || '';
      let zone2Id = obj.get('zone2Id') || '';

      // If no existing data, create default values
      if (position === undefined || position === null) {
        if (zoneObjects.length >= 2) {
          position = 1;
          zone1Id = zoneObjects[0].id;
          zone2Id = zoneObjects[1].id;
        } else if (zoneObjects.length === 1) {
          position = 0;
          zone1Id = zoneObjects[0].id;
          zone2Id = '';
        } else {
          position = 0;
          zone1Id = '';
          zone2Id = '';
        }
        // Save the default values to the fabric object
        obj.set({
          boundaryPosition: position,
          zone1Id: zone1Id,
          zone2Id: zone2Id,
        });
        canvas.requestRenderAll();
      }

      // Generate and assign boundary export ID if not already set
      let exportId = obj.get('exportId');
      if (!exportId) {
        exportId = `B${index + 1}`;
        obj.set('exportId', exportId);
        canvas.requestRenderAll();
      }

      // Presence sensor: single sensor per boundary
      const presenceSensorId = obj.get('presenceSensorId') || undefined;

      return {
        id: boundaryId,
        name: getBoundaryName(obj),
        zone1Id,
        zone2Id,
        visible: obj.visible !== false,
        position: position || 0,
        presenceSensorId,
        manualAssociation: obj.get('manualAssociation') || false,
      };
    });

    // Update boundaries state with all boundaries from fabric objects
    setBoundaries(allBoundaries);
  };

  const moveBoundary = (boundaryId: string, newPosition: number) => {
    const zoneObjects = groupedObjects.filter(group => group.isPolygon);

    if (newPosition < 0 || newPosition > zoneObjects.length) {
      return; // Invalid position
    }

    // Update the fabric object with new boundary data
    if (canvas) {
      const boundaryObj = canvas.getObjects().find(o => o.get('id') === boundaryId);
      if (boundaryObj) {
        let zone1Id = '';
        let zone2Id = '';

        if (newPosition === 0) {
          // Before first zone
          zone1Id = zoneObjects[0]?.id || '';
          zone2Id = '';
        } else if (newPosition === zoneObjects.length) {
          // After last zone
          zone1Id = zoneObjects[zoneObjects.length - 1]?.id || '';
          zone2Id = '';
        } else {
          // Between zones
          zone1Id = zoneObjects[newPosition - 1]?.id || '';
          zone2Id = zoneObjects[newPosition]?.id || '';
        }

        // Save the boundary data to the fabric object
        boundaryObj.set({
          boundaryPosition: newPosition,
          zone1Id: zone1Id,
          zone2Id: zone2Id,
        });
        canvas.requestRenderAll();
      }
    }

    setBoundaries(prev => {
      return prev.map(boundary => {
        if (boundary.id === boundaryId) {
          let zone1Id = '';
          let zone2Id = '';

          if (newPosition === 0) {
            // Before first zone
            zone1Id = zoneObjects[0]?.id || '';
            zone2Id = '';
          } else if (newPosition === zoneObjects.length) {
            // After last zone
            zone1Id = zoneObjects[zoneObjects.length - 1]?.id || '';
            zone2Id = '';
          } else {
            // Between zones
            zone1Id = zoneObjects[newPosition - 1]?.id || '';
            zone2Id = zoneObjects[newPosition]?.id || '';
          }

          return {
            ...boundary,
            position: newPosition,
            zone1Id,
            zone2Id,
          };
        }
        return boundary;
      });
    });
  };

  const getBoundaryDisplayName = (boundary: Boundary): string => {
    const zoneObjects = groupedObjects.filter(group => group.isPolygon);

    // Get boundary ID from canvas object's exportId
    let boundaryId = 'B?';
    if (canvas) {
      const boundaryObj = canvas.getObjects().find(obj => obj.get('id') === boundary.id);
      if (boundaryObj) {
        boundaryId = boundaryObj.get('exportId') || 'B?';
      }
    }

    // Use actual zone associations if available - show full zone names with IDs
    const zone1Name = boundary.zone1Id ? getZoneDisplayName(boundary.zone1Id) : '';
    const zone2Name = boundary.zone2Id ? getZoneDisplayName(boundary.zone2Id) : '';

    if (zone1Name && zone2Name) {
      return `${boundaryId}: ${boundary.name} (${zone1Name} to ${zone2Name})`;
    } else if (zone1Name) {
      return `${boundaryId}: ${boundary.name} (${zone1Name})`;
    } else if (zone2Name) {
      return `${boundaryId}: ${boundary.name} (${zone2Name})`;
    } else {
      // Fallback to position-based display
      if (boundary.position === 0) {
        return `${boundaryId}: ${boundary.name} (Before Z1)`;
      } else if (boundary.position === zoneObjects.length) {
        return `${boundaryId}: ${boundary.name} (After Z${zoneObjects.length})`;
      } else {
        const zone1Index = boundary.position;
        const zone2Index = boundary.position + 1;
        return `${boundaryId}: ${boundary.name} (Z${zone1Index}-Z${zone2Index})`;
      }
    }
  };

  const toggleBoundaryVisibility = (boundaryId: string) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === boundaryId);
    if (obj) {
      const isVisible = obj.visible;
      obj.set('visible', !isVisible);
      canvas.requestRenderAll();

      setBoundaries(prev =>
        prev.map(boundary =>
          boundary.id === boundaryId ? { ...boundary, visible: !isVisible } : boundary
        )
      );
    }
  };

  const deleteBoundary = (boundaryId: string) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === boundaryId);
    if (obj) {
      canvas.remove(obj);
      canvas.requestRenderAll();

      setBoundaries(prev => prev.filter(boundary => boundary.id !== boundaryId));
      setSelectedObject(null);
    }
  };

  // Clean up boundaries that no longer exist on canvas
  const cleanupBoundaries = () => {
    if (!canvas) return;

    const canvasBoundaryIds = new Set(
      canvas
        .getObjects()
        .filter(obj => isBoundaryObject(obj))
        .map(obj => obj.get('id'))
    );

    setBoundaries(prev => prev.filter(boundary => canvasBoundaryIds.has(boundary.id)));
  };
  const selectBoundary = (boundaryId: string) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === boundaryId);
    if (obj) {
      canvas.discardActiveObject();
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();

      const boundary = boundaries.find(b => b.id === boundaryId);
      if (boundary) {
        const selectedObj = objects.find(o => o.id === boundaryId);
        if (selectedObj) {
          setSelectedObject(selectedObj);
        }
      }
    }
  };

  // Helper functions for manual boundary associations
  const getAvailableZones = (): Array<{ id: string; name: string }> => {
    return groupedObjects
      .filter(group => group.isPolygon)
      .map(zone => ({
        id: zone.id,
        name: getZonePrefix(zone.id),
      }));
  };

  const getAllPresenceSensors = (): Array<{ id: string; name: string }> => {
    if (!canvas) return [];
    const allObjects = canvas.getObjects();
    const sensors = allObjects.filter(obj => obj.get('shapeId') === 3);
    return sensors.map(s => ({
      id: s.get('id'),
      name:
        getComponentTypePrefix({ type: 'group', shapeId: 3 } as GroupedObject) +
        (s.get('componentNumber') || s.get('exportId') || s.get('id').slice(-1)),
    }));
  };

  const updateBoundaryZones = (
    boundaryId: string,
    zone1Id: string,
    zone2Id: string,
    manualAssociation: boolean
  ) => {
    if (!canvas) return;
    const obj = canvas.getObjects().find(o => o.get('id') === boundaryId);
    if (obj) {
      obj.set({ zone1Id, zone2Id, manualAssociation });
      canvas.requestRenderAll();
    }
    setBoundaries(prev =>
      prev.map(b => (b.id === boundaryId ? { ...b, zone1Id, zone2Id, manualAssociation } : b))
    );
  };

  const addBoundaryPresenceSensor = (boundaryId: string, sensorId: string) => {
    if (!canvas) return;
    const obj = canvas.getObjects().find(o => o.get('id') === boundaryId);
    if (obj) {
      obj.set('presenceSensorId', sensorId);
      canvas.requestRenderAll();
      setBoundaries(prev =>
        prev.map(b => (b.id === boundaryId ? { ...b, presenceSensorId: sensorId } : b))
      );
    }
  };

  const removeBoundaryPresenceSensor = (boundaryId: string) => {
    if (!canvas) return;
    const obj = canvas.getObjects().find(o => o.get('id') === boundaryId);
    if (obj) {
      obj.set('presenceSensorId', undefined);
      canvas.requestRenderAll();
      setBoundaries(prev =>
        prev.map(b => (b.id === boundaryId ? { ...b, presenceSensorId: undefined } : b))
      );
    }
  };

  const handleSensorAssignment = (boundaryId: string, sensorId: string) => {
    addBoundaryPresenceSensor(boundaryId, sensorId);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, objectId: string) => {
    // Check if the object is a text object or switch component
    const draggedObject = objects.find(obj => obj.id === objectId);
    if (
      draggedObject &&
      (draggedObject.type === 'text' ||
        draggedObject.type === 'i-text' ||
        draggedObject.type === 'textbox')
    ) {
      // Prevent text objects from being dragged
      e.preventDefault();
      return;
    }

    // Check if the object is a switch component
    const fabricObj = canvas?.getObjects().find(o => o.get('id') === objectId);
    if (fabricObj && isSwitchObject(fabricObj)) {
      // Prevent switch components from being dragged
      e.preventDefault();
      return;
    }

    setDraggedObjectId(objectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverLayerId(layerId);
  };

  const handleDragLeave = () => {
    setDragOverLayerId(null);
  };

  const handleDrop = (e: React.DragEvent, toPolygonId: string, toLayerId: string) => {
    e.preventDefault();

    if (draggedObjectId) {
      // Validate: target layer must contain only one component type (shapeId)
      const draggedFabricObj = canvas?.getObjects().find(o => o.get('id') === draggedObjectId);
      const draggedShapeId = draggedFabricObj?.get('shapeId') as number | undefined;

      if (draggedFabricObj && draggedShapeId !== undefined) {
        const targetGroup = groupedObjects.find(
          group =>
            group.id === toPolygonId &&
            group.isPolygon &&
            group.layers?.some(l => l.id === toLayerId)
        );
        const targetLayer = targetGroup?.layers?.find(l => l.id === toLayerId);

        if (targetLayer) {
          const targetLayerShapeIds = (targetLayer.objectIds || [])
            .map(id => canvas?.getObjects().find(o => o.get('id') === id))
            .filter((o): o is fabric.Object => Boolean(o))
            .map(o => o.get('shapeId') as number | undefined)
            .filter((sid): sid is number => typeof sid === 'number');

          const existingDistinctShapeIds = Array.from(new Set(targetLayerShapeIds));

          if (
            existingDistinctShapeIds.length > 0 &&
            !existingDistinctShapeIds.includes(draggedShapeId)
          ) {
            // Disallow drop and revert
            console.warn('Drop blocked: target layer already contains a different component type.');
            setDraggedObjectId(null);
            setDragOverLayerId(null);
            return;
          }
        }
      }

      // Check if the dragged object is a text object or switch component
      const draggedObject = objects.find(obj => obj.id === draggedObjectId);
      if (
        draggedObject &&
        (draggedObject.type === 'text' ||
          draggedObject.type === 'i-text' ||
          draggedObject.type === 'textbox')
      ) {
        // Don't allow text objects to be moved to layers
        setDraggedObjectId(null);
        setDragOverLayerId(null);
        return;
      }

      // Check if the dragged object is a switch component
      const fabricObj = canvas?.getObjects().find(o => o.get('id') === draggedObjectId);
      if (fabricObj && isSwitchObject(fabricObj)) {
        // Don't allow switch components to be moved to layers
        setDraggedObjectId(null);
        setDragOverLayerId(null);
        return;
      }

      // Find the source polygon and layer
      const sourceGroup = groupedObjects.find(
        group =>
          group.isPolygon && group.layers?.some(layer => layer.objectIds.includes(draggedObjectId))
      );

      if (sourceGroup) {
        const sourceLayer = sourceGroup.layers?.find(layer =>
          layer.objectIds.includes(draggedObjectId)
        );

        if (sourceLayer) {
          // Get zone IDs from fabric objects
          const sourcePolygon = canvas?.getObjects().find(obj => obj.get('id') === sourceGroup.id);
          const sourceZoneId = sourcePolygon?.get('zoneId');
          moveObjectToLayer(draggedObjectId, sourceGroup.id, toPolygonId, toLayerId);

          // Regenerate export IDs for both source and target zones
          setTimeout(() => {
            if (sourceZoneId) {
              regenerateZoneExportIds(sourceZoneId);
            }
            const targetPolygon = canvas?.getObjects().find(obj => obj.get('id') === toPolygonId);
            const targetZoneId = targetPolygon?.get('zoneId');
            if (targetZoneId) {
              regenerateZoneExportIds(targetZoneId);
            }
          }, 100);
        }
      }
    }

    setDraggedObjectId(null);
    setDragOverLayerId(null);
  };

  // Boundary drag and drop handlers
  const handleBoundaryDragStart = (e: React.DragEvent, boundaryId: string) => {
    setDraggedBoundaryId(boundaryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleBoundaryDragOver = (e: React.DragEvent, targetPosition: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBoundaryPosition(targetPosition);
  };

  const handleBoundaryDragLeave = () => {
    setDragOverBoundaryPosition(null);
  };

  const handleBoundaryDrop = (e: React.DragEvent, targetPosition: number) => {
    e.preventDefault();

    if (draggedBoundaryId) {
      moveBoundary(draggedBoundaryId, targetPosition);
    }

    setDraggedBoundaryId(null);
    setDragOverBoundaryPosition(null);
  };

  // Cleanup hover effect when component unmounts or canvas changes
  useEffect(() => {
    return () => {
      // Clear any hover effects when component unmounts
      if (canvas && hoveredZoneId) {
        const polygon = canvas
          .getObjects()
          .find(obj => obj.get('id') === hoveredZoneId && obj.type === 'polygon');
        if (polygon) {
          // Get the original fill and visibility from ref map
          const originalState = zoneOriginalFillsRef.current.get(hoveredZoneId);
          if (originalState !== undefined) {
            polygon.set({
              fill: originalState.fill,
              visible: originalState.visible,
              dirty: true,
            });
          }
          // Clean up ref map
          zoneOriginalFillsRef.current.delete(hoveredZoneId);
          canvas.requestRenderAll();
        }
      }
    };
  }, [canvas, hoveredZoneId]);

  // Update objects list when canvas changes
  useEffect(() => {
    if (!canvas) return;

    // Listen for export ID regeneration requests
    const handleRegenerateExportIds = () => {
      generateAndStoreExportIds();
    };

    window.addEventListener('regenerateExportIds', handleRegenerateExportIds);

    const updateObjects = () => {
      const canvasObjects = canvas
        .getObjects()
        .filter(obj => obj.type !== 'image' && obj.get('id'));

      const nameCounts: Record<string, number> = {};
      const objectsList: CanvasObject[] = canvasObjects.map(obj => {
        const baseName = getObjectName(obj);
        nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
        const finalName =
          obj.type === 'polygon'
            ? nameCounts[baseName] === 1
              ? baseName
              : `${baseName} ${nameCounts[baseName] - 1}`
            : `${baseName} ${nameCounts[baseName]}`;

        // For groups, check if they have overlay items and get their properties
        let overlayColor = typeof obj.fill === 'string' ? obj.fill : '#000000';
        let overlayOpacity = obj.get('opacity') || 1;

        if (obj.type === 'group' && 'getObjects' in obj) {
          const group = obj as fabric.Group;
          const overlayItem = group.getObjects().find(child => {
            const category = child.get('shapeCategory') as ComponentType;
            return category === ComponentType.Overlay && child.visible !== false;
          });

          if (overlayItem) {
            overlayColor = typeof overlayItem.fill === 'string' ? overlayItem.fill : '#000000';
            overlayOpacity = overlayItem.opacity || 1;
          }
        }

        return {
          id: obj.get('id'),
          type: obj.type || 'unknown',
          name: finalName || obj.get('name'),
          roomName: obj.get('roomName'),
          features: obj.get('features'),
          color: overlayColor,
          strokeColor: typeof obj.stroke === 'string' ? obj.stroke : '#000000',
          strokeWidth: obj.strokeWidth || 1,
          width: obj.width,
          height: obj.height,
          left: obj.left,
          top: obj.top,
          angle: obj.angle,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          fontSize: obj.get('fontSize'),
          text: obj.get('text'),
          visible: obj.visible,
          opacity: overlayOpacity,
          shapeId: obj.get('shapeId'),
        };
      });

      // Update objects list immediately - this is fast
      setObjects(objectsList);

      // Debounce the heavy reconstruction operation to prevent canvas freezing
      if (reconstructTimeoutRef.current) {
        clearTimeout(reconstructTimeoutRef.current);
      }
      reconstructTimeoutRef.current = setTimeout(() => {
        const grouped = reconstructLayersFromObjects(objectsList);
        setGroupedObjects(grouped);

        // Debounce boundary initialization as well
        if (boundariesTimeoutRef.current) {
          clearTimeout(boundariesTimeoutRef.current);
        }
        boundariesTimeoutRef.current = setTimeout(() => {
          if (grouped.length > 0) {
            initializeBoundaries();
          }
        }, 50);
      }, 100);
    };

    const updateSelectedObject = () => {
      const activeObjects = canvas.getActiveObjects();

      if (activeObjects.length === 0) {
        // Don't set to null immediately - let selection:cleared handle it
        return;
      }

      if (activeObjects.length > 1) {
        setSelectedObject(null);
        setIsMultipleSelection(true);
        return;
      }

      setIsMultipleSelection(false);
      const activeObject = activeObjects[0];
      const activeId = activeObject.get('id');

      // Try to find the object in the current objects state first
      let selectedObj = objects.find(o => o.id === activeId);

      // If not found in objects state, create it from the active object
      if (!selectedObj && activeObject) {
        // For groups, check if they have overlay items and get their properties
        let overlayColor = typeof activeObject.fill === 'string' ? activeObject.fill : '#000000';
        let overlayOpacity = activeObject.get('opacity') || 1;

        if (activeObject.type === 'group' && 'getObjects' in activeObject) {
          const group = activeObject as fabric.Group;
          const overlayItem = group.getObjects().find(child => {
            const category = child.get('shapeCategory') as ComponentType;
            return category === ComponentType.Overlay && child.visible !== false;
          });

          if (overlayItem) {
            overlayColor = typeof overlayItem.fill === 'string' ? overlayItem.fill : '#000000';
            overlayOpacity = overlayItem.opacity || 1;
          }
        }

        selectedObj = {
          id: activeId,
          type: activeObject.type || 'unknown',
          name: getObjectName(activeObject),
          roomName: activeObject.get('roomName') || undefined,
          features: activeObject.get('features'),
          color: overlayColor,
          strokeColor: typeof activeObject.stroke === 'string' ? activeObject.stroke : '#000000',
          strokeWidth: activeObject.strokeWidth || 1,
          width: activeObject.width,
          height: activeObject.height,
          left: activeObject.left,
          top: activeObject.top,
          angle: activeObject.angle,
          scaleX: activeObject.scaleX,
          scaleY: activeObject.scaleY,
          fontSize: activeObject.get('fontSize'),
          text: activeObject.get('text'),
          visible: activeObject.visible !== false,
          opacity: overlayOpacity,
          shapeId: activeObject.get('shapeId') || undefined,
        };
      }

      if (selectedObj) {
        setSelectedObject(selectedObj);

        expandSingleObject(activeId);

        // Use current objects state or create a temporary one for reconstruction
        let objectsForReconstruction = objects;
        if (objects.length === 0) {
          // Create a temporary objects list from canvas objects
          const canvasObjects = canvas
            .getObjects()
            .filter(obj => obj.type !== 'image' && obj.get('id'));
          const nameCounts: Record<string, number> = {};
          objectsForReconstruction = canvasObjects.map(obj => {
            const baseName = getObjectName(obj);
            nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
            const finalName =
              obj.type === 'polygon'
                ? nameCounts[baseName] === 1
                  ? baseName
                  : `${baseName} ${nameCounts[baseName] - 1}`
                : `${baseName} ${nameCounts[baseName]}`;

            let overlayColor = typeof obj.fill === 'string' ? obj.fill : '#000000';
            let overlayOpacity = obj.get('opacity') || 1;

            if (obj.type === 'group' && 'getObjects' in obj) {
              const group = obj as fabric.Group;
              const overlayItem = group.getObjects().find(child => {
                const category = child.get('shapeCategory') as ComponentType;
                return category === ComponentType.Overlay && child.visible !== false;
              });

              if (overlayItem) {
                overlayColor = typeof overlayItem.fill === 'string' ? overlayItem.fill : '#000000';
                overlayOpacity = overlayItem.opacity || 1;
              }
            }

            return {
              id: obj.get('id'),
              type: obj.type || 'unknown',
              name: finalName || obj.get('name'),
              roomName: obj.get('roomName'),
              features: obj.get('features'),
              color: overlayColor,
              strokeColor: typeof obj.stroke === 'string' ? obj.stroke : '#000000',
              strokeWidth: obj.strokeWidth || 1,
              width: obj.width,
              height: obj.height,
              left: obj.left,
              top: obj.top,
              angle: obj.angle,
              scaleX: obj.scaleX,
              scaleY: obj.scaleY,
              fontSize: obj.get('fontSize'),
              text: obj.get('text'),
              visible: obj.visible,
              opacity: overlayOpacity,
              shapeId: obj.get('shapeId'),
            };
          });
        }

        const updatedGrouped = reconstructLayersFromObjects(objectsForReconstruction);
        setGroupedObjects(updatedGrouped);

        const containingPolygon = updatedGrouped.find(
          group =>
            group.isPolygon &&
            group.containedObjects &&
            group.containedObjects.some(obj => obj.id === activeId)
        );

        if (containingPolygon) {
          setExpandedGroups(prev => {
            const newSet = new Set(prev);
            newSet.add(containingPolygon.id);
            return newSet;
          });

          // Find and expand the layer containing this object
          if (containingPolygon.layers) {
            const containingLayer = containingPolygon.layers.find(layer =>
              layer.objectIds.includes(activeId)
            );

            if (containingLayer) {
              setExpandedLayers(prev => {
                const newSet = new Set(prev);
                newSet.add(containingLayer.id);
                return newSet;
              });
            }
          }
        }

        setTimeout(() => {
          // Ensure sidebar is expanded for scrolling to work
          if (!isExpanded) {
            toggleSidebar();
            // Wait a bit more for the expansion animation
            setTimeout(() => {
              scrollToObject(activeId);
            }, 300);
          } else {
            scrollToObject(activeId);
          }
        }, 200);
      }
    };

    // Initial update - call updateObjects immediately when canvas is ready
    updateObjects();
    // Generate export IDs after grouped objects are set up
    setTimeout(() => {
      // Ensure grouped objects are available before generating export IDs
      if (groupedObjects.length > 0) {
        generateAndStoreExportIds();
      } else {
        // If grouped objects aren't ready, wait a bit more
        setTimeout(() => generateAndStoreExportIds(), 200);
      }
    }, 100);

    // Listen for canvas changes
    const handleObjectAdded = () => {
      // Debounce to prevent canvas freezing on rapid additions
      if (updateObjectsTimeoutRef.current) {
        clearTimeout(updateObjectsTimeoutRef.current);
      }
      updateObjectsTimeoutRef.current = setTimeout(() => {
        updateObjects();
        // Generate export IDs after grouped objects are updated
        setTimeout(() => generateAndStoreExportIds(), 150);

        // Check if a new boundary was added and initialize boundaries
        if (canvas) {
          const boundaryObjects = canvas.getObjects().filter(obj => isBoundaryObject(obj));
          const existingBoundaryIds = new Set(boundaries.map(b => b.id));
          const newBoundaries = boundaryObjects.filter(
            obj => !existingBoundaryIds.has(obj.get('id'))
          );

          if (newBoundaries.length > 0) {
            // Use initializeBoundaries to properly load all boundaries with their data
            initializeBoundaries();
          }
        }
      }, 100);
    };

    const handleObjectRemoved = () => {
      // Debounce to prevent canvas freezing
      if (updateObjectsTimeoutRef.current) {
        clearTimeout(updateObjectsTimeoutRef.current);
      }
      updateObjectsTimeoutRef.current = setTimeout(() => {
        updateObjects();
        // Generate export IDs after grouped objects are updated
        setTimeout(() => generateAndStoreExportIds(), 150);
        cleanupBoundaries();

        // Re-initialize boundaries after cleanup to ensure state is correct
        if (canvas && groupedObjects.length > 0) {
          initializeBoundaries();
        }
      }, 100);
    };

    const handleObjectModified = () => {
      // Debounce to prevent canvas freezing during drag/resize
      if (updateObjectsTimeoutRef.current) {
        clearTimeout(updateObjectsTimeoutRef.current);
      }
      updateObjectsTimeoutRef.current = setTimeout(() => {
        updateObjects();
        // Generate export IDs after grouped objects are updated
        setTimeout(() => generateAndStoreExportIds(), 150);

        // Re-initialize boundaries after modification to ensure state is correct
        if (canvas && groupedObjects.length > 0) {
          initializeBoundaries();
        }
      }, 150);
    };

    const handleSelectionCreated = () => {
      // Instant selection update - no delays for ObjectControlBar
      updateSelectedObject();
    };

    const handleSelectionUpdated = () => {
      // Instant selection update - no delays for ObjectControlBar
      updateSelectedObject();
    };

    const handleSelectionCleared = () => {
      // Instant clear - no delays
      setSelectedObject(null);
      setIsMultipleSelection(false);
    };

    const handleMouseDown = (e: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (e.target) {
        // Instant selection update when clicking on an object
        updateSelectedObject();
      }
    };

    canvas.on('object:added', handleObjectAdded);
    canvas.on('object:removed', handleObjectRemoved);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('selection:created', handleSelectionCreated);
    canvas.on('selection:updated', handleSelectionUpdated);
    canvas.on('selection:cleared', handleSelectionCleared);
    canvas.on('mouse:down', handleMouseDown);

    return () => {
      // Clear all pending timeouts to prevent memory leaks
      if (updateObjectsTimeoutRef.current) {
        clearTimeout(updateObjectsTimeoutRef.current);
      }
      if (reconstructTimeoutRef.current) {
        clearTimeout(reconstructTimeoutRef.current);
      }
      if (boundariesTimeoutRef.current) {
        clearTimeout(boundariesTimeoutRef.current);
      }

      // Remove event listeners
      canvas.off('object:added', handleObjectAdded);
      canvas.off('object:removed', handleObjectRemoved);
      canvas.off('object:modified', handleObjectModified);
      canvas.off('selection:created', handleSelectionCreated);
      canvas.off('selection:updated', handleSelectionUpdated);
      canvas.off('selection:cleared', handleSelectionCleared);
      canvas.off('mouse:down', handleMouseDown);
      window.removeEventListener('regenerateExportIds', handleRegenerateExportIds);
    };
  }, [canvas]);

  // Function to get component type prefix
  const getComponentTypePrefix = (obj: GroupedObject): string => {
    const shapeId = obj.shapeId;
    if (shapeId) {
      // Check if it's a light component (you may need to adjust these shapeId ranges)
      if ([1, 2, 4, 5, 6, 8].includes(shapeId)) {
        return 'F';
      }
      // Check if it's a switch component
      if ([3, 7, 13].includes(shapeId)) {
        return 'C';
      }
    }
    return '';
  };

  // Function to get layer prefix
  // const getLayerPrefix = (layer: Layer, polygonId: string): string => {
  //   const polygonGroup = groupedObjects.find(g => g.id === polygonId);
  //   if (polygonGroup && polygonGroup.layers) {
  //     const layerIndex = polygonGroup.layers.findIndex(l => l.id === layer.id);
  //     return layerIndex >= 0 ? `L${layerIndex + 1}` : '';
  //   }
  //   return '';
  // };

  // Function to get zone prefix
  const getZonePrefix = (polygonId: string): string => {
    const zoneIndex = groupedObjects.findIndex(group => group.id === polygonId);
    return zoneIndex >= 0 ? `Z${zoneIndex + 1}` : '';
  };

  // Get full zone display name with ID (e.g., "Living Room (Z1)")
  const getZoneDisplayName = (polygonId: string): string => {
    const zone = groupedObjects.find(group => group.id === polygonId);
    if (!zone) return '';
    const zonePrefix = getZonePrefix(polygonId);
    const zoneName = zone.name || 'Unnamed Zone';
    return `${zoneName} (${zonePrefix})`;
  };

  // Function to get global component number for a specific shape ID
  // Function to fill gaps in component numbering after moving
  const fillComponentNumberGaps = () => {
    if (!canvas) return;

    const allObjects = canvas.getObjects();
    const componentPrefixes = ['F', 'C']; // All component prefixes

    componentPrefixes.forEach(prefix => {
      // Get all components with this prefix
      const componentsWithPrefix = allObjects.filter(obj => {
        const objShapeId = obj.get('shapeId');
        const objPrefix = getComponentTypePrefix({ shapeId: objShapeId } as GroupedObject);
        return objPrefix === prefix;
      });

      if (prefix === 'C') {
        // Get all C components regardless of shapeId
        const allCComponents = componentsWithPrefix;

        // Sort all C components by current component number
        const sortedCComponents = allCComponents.sort((a: fabric.Object, b: fabric.Object) => {
          const aNum = a.get('componentNumber') || 0;
          const bNum = b.get('componentNumber') || 0;
          return aNum - bNum;
        });

        // Separate components by shapeId for proper numbering ranges
        const shapeId7Components = sortedCComponents.filter(obj => obj.get('shapeId') === 7);
        const otherShapeIdComponents = sortedCComponents.filter(obj => obj.get('shapeId') !== 7);

        // Process shapeId 7 components (start from 100)
        if (shapeId7Components.length > 0) {
          let expectedNumber = 100;

          shapeId7Components.forEach((obj: fabric.Object) => {
            const currentNumber = obj.get('componentNumber');
            if (currentNumber !== expectedNumber) {
              obj.set('componentNumber', expectedNumber);
              updateExportIdWithComponentNumber(obj, expectedNumber);
            }
            expectedNumber++;
          });
        }

        // Process other shapeId components (start from 1)
        if (otherShapeIdComponents.length > 0) {
          let expectedNumber = 1;

          otherShapeIdComponents.forEach((obj: fabric.Object) => {
            const currentNumber = obj.get('componentNumber');

            if (currentNumber !== expectedNumber) {
              obj.set('componentNumber', expectedNumber);
              updateExportIdWithComponentNumber(obj, expectedNumber);
            }
            expectedNumber++;
          });
        }
      } else {
        // Group components by shapeId, zoneId, and layerId
        const componentGroups = new Map();
        componentsWithPrefix.forEach(obj => {
          const shapeId = obj.get('shapeId');
          const zoneId = obj.get('zoneUuid');
          const layerId = obj.get('layerUuid');
          const componentNumber = obj.get('componentNumber');

          if (shapeId !== undefined && zoneId !== undefined && componentNumber !== undefined) {
            const key = `${shapeId}_${zoneId}_${layerId || 'no-layer'}`;
            if (!componentGroups.has(key)) {
              componentGroups.set(key, []);
            }
            componentGroups.get(key).push(obj);
          }
        });

        // Separate groups by shapeId to handle different numbering ranges
        const shapeId7Groups = new Map();
        const otherShapeIdGroups = new Map();

        componentGroups.forEach((group, key) => {
          const shapeId = group[0].get('shapeId');
          if (shapeId === 7) {
            shapeId7Groups.set(key, group);
          } else {
            otherShapeIdGroups.set(key, group);
          }
        });

        // Process shapeId 7 groups (start from 100)
        if (shapeId7Groups.size > 0) {
          const numberToGroupMap = new Map();
          shapeId7Groups.forEach(group => {
            const num = group[0].get('componentNumber');
            if (num !== undefined && num !== null) {
              numberToGroupMap.set(parseInt(num), group);
            }
          });

          let expectedNumber = 100;
          const sortedNumbers = Array.from(numberToGroupMap.keys()).sort((a, b) => a - b);

          sortedNumbers.forEach(currentNumber => {
            const group = numberToGroupMap.get(currentNumber);
            if (group && currentNumber !== expectedNumber) {
              group.forEach((obj: fabric.Object) => {
                obj.set('componentNumber', expectedNumber);
                updateExportIdWithComponentNumber(obj, expectedNumber);
              });
            }
            expectedNumber++;
          });
        }

        // Process other shapeId groups (start from 1)
        if (otherShapeIdGroups.size > 0) {
          const numberToGroupMap = new Map();
          otherShapeIdGroups.forEach(group => {
            const num = group[0].get('componentNumber');
            if (num !== undefined && num !== null) {
              numberToGroupMap.set(parseInt(num), group);
            }
          });

          let expectedNumber = 1;
          const sortedNumbers = Array.from(numberToGroupMap.keys()).sort((a, b) => a - b);

          sortedNumbers.forEach(currentNumber => {
            const group = numberToGroupMap.get(currentNumber);
            if (group && currentNumber !== expectedNumber) {
              group.forEach((obj: fabric.Object) => {
                obj.set('componentNumber', expectedNumber);
                updateExportIdWithComponentNumber(obj, expectedNumber);
              });
            }
            expectedNumber++;
          });
        }
      }
    });

    canvas.requestRenderAll();
  };

  // Function to update exportId with component number
  const updateExportIdWithComponentNumber = (obj: fabric.Object, componentNumber: number) => {
    const shapeId = obj.get('shapeId');
    const componentPrefix = getComponentTypePrefix({ shapeId } as GroupedObject);
    const zoneId = obj.get('polygonId');
    const layerId = obj.get('layerId');

    if (componentPrefix && zoneId) {
      const exportId = `${componentPrefix}${componentNumber}_${zoneId}${layerId ? `_${layerId}` : ''}`;
      obj.set('exportId', exportId);
    }
  };

  const getGlobalComponentNumber = (
    shapeId: number,
    zoneId: string,
    layerId?: string,
    isMoving: boolean = false
  ): number => {
    if (!canvas) {
      return shapeId === 7 ? 100 : 1;
    }

    const allObjects = canvas.getObjects();
    const componentPrefix = getComponentTypePrefix({ shapeId } as GroupedObject);

    if (!componentPrefix) {
      return shapeId === 7 ? 100 : 1;
    }

    // For C prefix components (switches), always use global numbering across all zones
    if (componentPrefix === 'C') {
      // Get all components with same prefix for global numbering
      const allComponentsWithSamePrefix = allObjects.filter(obj => {
        const objShapeId = obj.get('shapeId');
        const objPrefix = getComponentTypePrefix({ shapeId: objShapeId } as GroupedObject);
        return objPrefix === componentPrefix;
      });

      const allNumbers = allComponentsWithSamePrefix
        .map(obj => obj.get('componentNumber'))
        .filter(num => num !== undefined && num !== null)
        .map(num => parseInt(num))
        .sort((a, b) => a - b);

      // If moving, get next available global number based on shapeId
      if (isMoving) {
        // Filter numbers based on shapeId to handle different ranges
        const relevantNumbers = allNumbers.filter(num => {
          if (shapeId === 7) {
            return num >= 100; // Only consider numbers >= 100 for shapeId 7
          } else {
            return num < 100; // Only consider numbers < 100 for other shapeIds
          }
        });

        const maxNumber = relevantNumbers.length > 0 ? Math.max(...relevantNumbers) : 0;
        const nextNumber = maxNumber + 1;
        return nextNumber;
      }

      // For new C components, find the first gap or return the next number
      // Special handling for shapeId 7 - start from 100
      const startNumber = shapeId === 7 ? 100 : 1;
      let nextNumber = startNumber;

      // Filter numbers based on shapeId to handle different ranges
      const relevantNumbers = allNumbers.filter(num => {
        if (shapeId === 7) {
          return num >= 100; // Only consider numbers >= 100 for shapeId 7
        } else {
          return num < 100; // Only consider numbers < 100 for other shapeIds
        }
      });

      for (let i = 0; i < relevantNumbers.length; i++) {
        if (relevantNumbers[i] !== nextNumber) {
          return nextNumber; // Found a gap
        }
        nextNumber++;
      }
      return nextNumber; // No gaps, return the next number
    }

    // Get all components of the same shape ID in the same zone/layer
    const sameShapeComponents = allObjects.filter(obj => {
      const objShapeId = obj.get('shapeId');
      const objZoneId = obj.get('zoneUuid');
      const objLayerId = obj.get('layerUuid');

      if (objShapeId !== shapeId) return false;

      // For layer components (F), check zone and layer
      return objZoneId === zoneId && objLayerId === layerId;
    });

    // Check if there's already a component of this shape ID in this zone/layer
    const existingInSameZoneLayer = sameShapeComponents
      .map(obj => obj.get('componentNumber'))
      .filter(num => num !== undefined && num !== null)
      .map(num => parseInt(num));

    if (existingInSameZoneLayer.length > 0) {
      const result = Math.max(...existingInSameZoneLayer);
      return result;
    }

    // For F prefix components, continue with zone/layer specific logic
    // Get all components with same prefix for global numbering (for F components, this is still zone/layer specific)
    const allComponentsWithSamePrefix = allObjects.filter(obj => {
      const objShapeId = obj.get('shapeId');
      const objPrefix = getComponentTypePrefix({ shapeId: objShapeId } as GroupedObject);
      return objPrefix === componentPrefix;
    });

    const allNumbers = allComponentsWithSamePrefix
      .map(obj => obj.get('componentNumber'))
      .filter(num => num !== undefined && num !== null)
      .map(num => parseInt(num))
      .sort((a, b) => a - b);

    // If moving, get next available global number
    if (isMoving) {
      const maxNumber = allNumbers.length > 0 ? Math.max(...allNumbers) : 0;
      const nextNumber = maxNumber + 1;
      return nextNumber;
    }

    // For new F components, find the first gap or return the next number
    // Special handling for shapeId 7 - start from 100
    const startNumber = shapeId === 7 ? 100 : 1;
    let nextNumber = startNumber;

    // Filter numbers based on shapeId to handle different ranges
    const relevantNumbers = allNumbers.filter(num => {
      if (shapeId === 7) {
        return num >= 100; // Only consider numbers >= 100 for shapeId 7
      } else {
        return num < 100; // Only consider numbers < 100 for other shapeIds
      }
    });

    for (let i = 0; i < relevantNumbers.length; i++) {
      if (relevantNumbers[i] !== nextNumber) {
        return nextNumber; // Found a gap
      }
      nextNumber++;
    }
    return nextNumber; // No gaps, return the next number
  };

  // Function to check if object is inside polygon (reusable version)
  const isObjectInsidePolygonGlobal = (obj: fabric.Object, polygon: fabric.Polygon): boolean => {
    const polygonPoints: Point[] = polygon.get('points').map((p: Point) => {
      const x = p.x * (polygon.scaleX || 1) + (polygon.left || 0);
      const y = p.y * (polygon.scaleY || 1) + (polygon.top || 0);
      return { x, y };
    });
    let finalPolygonPoints = polygonPoints;
    try {
      const polygonCoords = polygon.getCoords();
      if (polygonCoords && polygonCoords.length > 0) {
        finalPolygonPoints = polygonCoords.map(p => ({ x: p.x, y: p.y }));
      }
    } catch {}
    const objBounds = obj.getBoundingRect();
    const objCenter = obj.getCenterPoint();
    const isCenterInside = isPointInPolygon(objCenter, finalPolygonPoints);
    let isInside = isCenterInside;
    if (!isCenterInside && (objBounds.width > 20 || objBounds.height > 20)) {
      try {
        const corners = obj.getCoords();
        isInside = corners.some(point => isPointInPolygon(point, finalPolygonPoints));
      } catch {
        isInside = isCenterInside;
      }
    }
    if (!isInside) {
      const overlapArea = calculateOverlapArea(obj, polygon);
      const objArea = objBounds.width * objBounds.height;
      const overlapRatio = overlapArea / objArea;
      if (overlapRatio > 0.5) {
        isInside = true;
      }
    }
    return isInside;
  };

  // Function to regenerate export IDs for a specific zone when objects are moved
  const regenerateZoneExportIds = (zoneId: string) => {
    if (!canvas) return;

    const allObjects = canvas.getObjects();
    const polygons = allObjects.filter(obj => obj.type === 'polygon');

    // Find the polygon for this zone
    const polygon = polygons.find(poly => {
      const polyZoneId = poly.get('zoneId');
      return polyZoneId === zoneId;
    });

    if (!polygon) return;

    const roomName = polygon.get('roomName') || '';

    // Get all objects inside this polygon
    const containedObjects = allObjects.filter(obj => {
      if (obj.type === 'polygon') return false;
      return isObjectInsidePolygonGlobal(obj, polygon as fabric.Polygon);
    });

    // Group objects by type (F or C) for component counting
    const fObjects: fabric.Object[] = [];
    const cObjects: fabric.Object[] = [];

    containedObjects.forEach(obj => {
      const shapeId = obj.get('shapeId');
      if (shapeId) {
        if ([1, 2, 4, 5, 6, 8].includes(shapeId)) {
          fObjects.push(obj);
        } else if ([3, 7, 13].includes(shapeId)) {
          cObjects.push(obj);
        }
      }
    });

    // Reassign F component IDs for this zone
    fObjects.forEach((obj, index) => {
      const componentId = `F${index + 1}`;
      obj.set('exportId', componentId);
      obj.set('componentId', componentId);
      obj.set('zoneId', zoneId);
      obj.set('roomName', roomName);
    });

    // Reassign C component IDs for this zone
    cObjects.forEach((obj, index) => {
      const componentId = `C${index + 1}`;
      obj.set('exportId', componentId);
      obj.set('componentId', componentId);
      obj.set('zoneId', zoneId);
      obj.set('roomName', roomName);
    });

    canvas.requestRenderAll();
  };

  // Function to generate and store export IDs on fabric objects
  const generateAndStoreExportIds = () => {
    if (!canvas) return;

    const allObjects = canvas.getObjects();
    const polygons = allObjects.filter(obj => obj.type === 'polygon');

    // Use the same logic as the sidebar to get zone IDs
    polygons.forEach(polygon => {
      const polygonId = polygon.get('id');
      const roomName = polygon.get('roomName') || '';

      // Use the same getZonePrefix logic as the sidebar
      let zoneIndex = groupedObjects.findIndex(group => group.id === polygonId);
      let zoneId = zoneIndex >= 0 ? `Z${zoneIndex + 1}` : '';

      // If groupedObjects is empty or polygon not found, try to generate zone ID from polygon order
      if (zoneIndex === -1 && groupedObjects.length === 0) {
        const allPolygons = allObjects.filter(obj => obj.type === 'polygon');
        zoneIndex = allPolygons.findIndex(poly => poly.get('id') === polygonId);
        zoneId = zoneIndex >= 0 ? `Z${zoneIndex + 1}` : '';
      }

      // Only update zone ID if it's different or doesn't exist
      const existingZoneId = polygon.get('zoneId');
      if (!existingZoneId || existingZoneId !== zoneId) {
        polygon.set('exportId', zoneId);
        polygon.set('zoneId', zoneId);
      }
      polygon.set('roomName', roomName);
    });

    // Generate component IDs (F1, C1, etc.) and layer IDs (L1, L2, etc.)
    polygons.forEach(polygon => {
      const zoneId = polygon.get('zoneId') || '';
      const roomName = polygon.get('roomName') || '';

      // Get all objects inside this polygon
      const containedObjects = allObjects.filter(obj => {
        if (obj.type === 'polygon') return false;
        return isObjectInsidePolygonGlobal(obj, polygon as fabric.Polygon);
      });

      // Group objects by type (F or C) for component counting
      const fObjects: fabric.Object[] = [];
      const cObjects: fabric.Object[] = [];

      containedObjects.forEach(obj => {
        const shapeId = obj.get('shapeId');
        if (shapeId) {
          if ([1, 2, 4, 5, 6, 8].includes(shapeId)) {
            fObjects.push(obj);
          } else if ([3, 7, 13].includes(shapeId)) {
            cObjects.push(obj);
          }
        }
      });

      // Assign F component IDs and store zone/room info
      fObjects.forEach((obj, index) => {
        const componentId = `F${index + 1}`;
        const componentNumber = index + 1;
        const existingComponentId = obj.get('componentId');
        const existingExportId = obj.get('exportId');

        // Only update if the component ID doesn't exist or if the object has moved to a different zone
        const existingZoneId = obj.get('zoneId');
        const existingComponentNumber = obj.get('componentNumber');

        if (!existingComponentId || !existingExportId || existingZoneId !== zoneId) {
          obj.set('exportId', componentId);
          obj.set('componentId', componentId);
          // Preserve existing component number if it exists, otherwise use the new one
          obj.set(
            'componentNumber',
            existingComponentNumber !== undefined ? existingComponentNumber : componentNumber
          );
        }

        // Always update zone and room info as these can change
        obj.set('zoneId', zoneId);
        obj.set('roomName', roomName);
      });

      // Assign C component IDs and store zone/room info
      cObjects.forEach((obj, index) => {
        const componentId = `C${index + 1}`;
        const componentNumber = index + 1;
        const existingComponentId = obj.get('componentId');
        const existingExportId = obj.get('exportId');

        // Only update if the component ID doesn't exist or if the object has moved to a different zone
        const existingZoneId = obj.get('zoneId');
        const existingComponentNumber = obj.get('componentNumber');

        if (!existingComponentId || !existingExportId || existingZoneId !== zoneId) {
          obj.set('exportId', componentId);
          obj.set('componentId', componentId);
          // Preserve existing component number if it exists, otherwise use the new one
          obj.set(
            'componentNumber',
            existingComponentNumber !== undefined ? existingComponentNumber : componentNumber
          );
        }

        // Always update zone and room info as these can change
        obj.set('zoneId', zoneId);
        obj.set('roomName', roomName);
      });

      // Generate layer IDs for this polygon
      const layers = new Set<string>();
      containedObjects.forEach(obj => {
        const layerId = obj.get('layerId');
        if (layerId) {
          layers.add(layerId);
        }
      });

      const layerArray = Array.from(layers);
      layerArray.forEach((layerId, layerIndex) => {
        const layerExportId = `L${layerIndex + 1}`;
        // Store layer export ID on all objects in this layer
        containedObjects.forEach(obj => {
          if (obj.get('layerId') === layerId) {
            // Always update layer export ID to ensure consistency after layer deletion/reordering
            obj.set('layerExportId', layerExportId);
          }
        });
      });
    });

    canvas.requestRenderAll();
  };

  // Function to get display name with prefix
  const getDisplayName = (obj: GroupedObject, polygonId?: string): string => {
    if (obj.isPolygon) {
      // For polygons/zones, use Z prefix
      const zonePrefix = getZonePrefix(obj.id);
      return `${zonePrefix}: ${obj.name}`;
    } else {
      // For components, use F or C prefix based on type
      const componentPrefix = getComponentTypePrefix(obj);
      if (componentPrefix && obj.shapeId && polygonId) {
        // Get the component number from the fabric object
        const fabricObj = canvas?.getObjects().find(o => o.get('id') === obj.id);
        const componentNumber = fabricObj?.get('componentNumber');

        if (componentNumber) {
          return `${componentPrefix}${componentNumber}: ${obj.name}`;
        }
      }
      return obj.name;
    }
  };

  const getObjectName = (obj: fabric.Object): string => {
    return obj.get('name');
  };

  const getObjectIcon = (type: string, shapeId?: number) => {
    if (shapeId) {
      const sidebarItem = sidebar.find(item => item.id === shapeId);
      if (sidebarItem) {
        return (
          <img src={sidebarItem.image} alt={sidebarItem.title} className="w-4 h-4 object-contain" />
        );
      }
    }

    switch (type) {
      case 'circle':
        return <Circle className="w-4 h-4" />;
      case 'rect':
        return <Square className="w-4 h-4" />;
      case 'line':
        return <Minus className="w-4 h-4" />;
      case 'polygon':
        return <div className="w-4 h-4 border-2 border-current" />;
      case 'text':
      case 'i-text':
      case 'textbox':
        return <Type className="w-4 h-4" />;
      case 'group':
        return <div className="w-4 h-4 border border-current rounded" />;
      default:
        return <div className="w-4 h-4 border border-current rounded" />;
    }
  };

  const selectObject = (objectId: string) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === objectId);

    if (obj) {
      const isAlreadySelected = selectedObject?.id === objectId;
      if (isAlreadySelected) {
        const isCurrentlyExpanded = expandedObjects.has(objectId);
        if (isCurrentlyExpanded) {
          setExpandedObjects(new Set());
        } else {
          expandSingleObject(objectId);
          setTimeout(() => {
            // Ensure sidebar is expanded for scrolling to work
            if (!isExpanded) {
              toggleSidebar();
              // Wait a bit more for the expansion animation
              setTimeout(() => {
                scrollToObject(objectId);
              }, 300);
            } else {
              scrollToObject(objectId);
            }
          }, 200);
        }
      } else {
        canvas.discardActiveObject();
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        const selectedObj = objects.find(o => o.id === objectId);

        if (selectedObj) {
          setSelectedObject(selectedObj);
          expandSingleObject(objectId);

          const updatedGrouped = reconstructLayersFromObjects(objects);
          setGroupedObjects(updatedGrouped);

          // Find containing polygon and expand it
          const containingPolygon = updatedGrouped.find(
            group =>
              group.isPolygon &&
              group.containedObjects &&
              group.containedObjects.some(obj => obj.id === objectId)
          );

          if (containingPolygon) {
            setExpandedGroups(prev => {
              const newSet = new Set(prev);
              newSet.add(containingPolygon.id);
              return newSet;
            });

            // Find and expand the layer containing this object
            if (containingPolygon.layers) {
              const containingLayer = containingPolygon.layers.find(layer =>
                layer.objectIds.includes(objectId)
              );
              if (containingLayer) {
                setExpandedLayers(prev => {
                  const newSet = new Set(prev);
                  newSet.add(containingLayer.id);
                  return newSet;
                });
              }
            }
          }

          setTimeout(() => {
            // Ensure sidebar is expanded for scrolling to work
            if (!isExpanded) {
              toggleSidebar();
              // Wait a bit more for the expansion animation
              setTimeout(() => {
                scrollToObject(objectId);
              }, 300);
            } else {
              scrollToObject(objectId);
            }
          }, 200);
        }
      }
    }
  };

  const deleteObject = (objectId: string) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
    if (obj) {
      canvas.remove(obj);
      canvas.requestRenderAll();
      setSelectedObject(null);
      setExpandedObjects(new Set());

      // Fill gaps in component numbering after deletion
      fillComponentNumberGaps();

      // Remove object from all layers and delete empty layers
      setGroupedObjects(prev => {
        return prev.map(group => {
          if (group.isPolygon && group.layers) {
            // Remove object from all layers
            const updatedLayers = group.layers
              .map(layer => ({
                ...layer,
                objectIds: layer.objectIds.filter(id => id !== objectId),
              }))
              // Filter out empty layers (layers with no objects)
              .filter(layer => layer.objectIds.length > 0);

            // If layers changed, update the polygon on canvas and reset mix
            if (updatedLayers.length !== group.layers.length) {
              const polygonObj = canvas.getObjects().find(p => p.get('id') === group.id);
              if (polygonObj && polygonObj.type === 'polygon') {
                // Convert to PolygonLayer format for canvas storage
                const polygonLayers = updatedLayers.map(layer => ({
                  id: layer.id,
                  layerId: layer.id, // Use layer id as layerId
                  name: layer.name,
                  visible: layer.visible !== false,
                  objectIds: layer.objectIds,
                }));
                polygonObj.set('layers', polygonLayers);

                // Reset mix since layer count changed
                polygonObj.set('mix', '');
                setZoneMixMap(prev => {
                  const newMap = { ...prev };
                  delete newMap[group.id];
                  return newMap;
                });
              }
            }

            return {
              ...group,
              layers: updatedLayers,
            };
          }
          return group;
        });
      });
    }
  };

  const toggleVisibility = (objectId: string) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
    if (obj) {
      const isVisible = obj.visible;
      obj.set('visible', !isVisible);
      canvas.requestRenderAll();

      setObjects(prev => prev.map(o => (o.id === objectId ? { ...o, visible: !isVisible } : o)));

      // Update contained objects in grouped objects
      setGroupedObjects(prev => {
        return prev.map(group => {
          if (group.containedObjects) {
            const updatedContainedObjects = group.containedObjects.map(contained => {
              if (contained.id === objectId) {
                return { ...contained, visible: !isVisible };
              }
              return contained;
            });
            return {
              ...group,
              containedObjects: updatedContainedObjects,
            };
          }
          return group;
        });
      });

      if (!isVisible === false) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        setSelectedObject(null);
      } else if (selectedObject?.id === objectId) {
        setSelectedObject(prev => (prev ? { ...prev, visible: !isVisible } : null));
      }
    }
  };

  // Place this just before the line where isTextObject is first used in reconstructLayersFromObjects:
  const isTextObject = (obj: CanvasObject): boolean => {
    return obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox';
  };

  return (
    <>
      <div
        className={`bg-white border border-light-gray h-full rounded-[12px] transition-all duration-300 ${
          isExpanded ? 'w-80 overflow-y-auto px-0' : 'w-16 overflow-hidden px-1'
        } flex flex-col`}
        ref={sidebarRef}
      >
        {/* Header with toggle button */}
        <div
          className={`border-b border-gray-100 ${isExpanded ? 'p-4' : 'p-0'} flex ${isExpanded ? 'justify-between items-center' : 'justify-center items-center h-16'}`}
        >
          {isExpanded && (
            <h2 className="text-lg font-medium text-gray-900">Components ({objects.length})</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 transition-colors duration-200 rounded-lg cursor-pointer"
            onClick={toggleSidebar}
            title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <PanelLeftIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className={isExpanded ? 'p-4 flex-1 overflow-y-auto' : 'p-1 flex-1 overflow-hidden'}>
          <div className="space-y-2">
            {useMemo(() => {
              const zoneObjects = groupedObjects.filter(group => group.isPolygon);
              const standaloneObjects = groupedObjects.filter(group => !group.isPolygon);
              const sortedBoundaries = [...boundaries].sort((a, b) => a.position - b.position);

              const renderItems: React.ReactElement[] = [];

              // Render zones and boundaries in order
              zoneObjects.forEach((zone, zoneIndex) => {
                // console.log('🚀 ~ CanvasSidebar ~ zone:', zone);
                const boundariesBeforeZone = sortedBoundaries.filter(b => b.position === zoneIndex);
                // Drop indicator before this zone
                if (dragOverBoundaryPosition === zoneIndex) {
                  renderItems.push(
                    <div key={`drop-indicator-before-${zone.id}`} className="px-2">
                      <div className="h-0.5 bg-blue-500 rounded-full my-1" />
                    </div>
                  );
                }
                boundariesBeforeZone.forEach(boundary => {
                  const isBoundarySelected = selectedObject?.id === boundary.id;
                  renderItems.push(
                    <Card
                      key={`boundary-${boundary.id}`}
                      data-object-id={boundary.id}
                      className={`cursor-pointer transition-all duration-200 ${
                        isBoundarySelected
                          ? 'bg-blue-50 border-blue-200'
                          : draggedBoundaryId === boundary.id
                            ? 'bg-yellow-50 border-yellow-300 shadow-lg scale-105'
                            : 'hover:bg-gray-50'
                      } ${boundary.visible === false ? 'opacity-50' : ''} ${
                        isExpanded ? 'p-2' : 'p-1'
                      }`}
                      onClick={e => handleBoundaryCardClick(e, boundary.id)}
                      draggable
                      onDragStart={e => handleBoundaryDragStart(e, boundary.id)}
                    >
                      <div
                        className={`flex items-center ${isExpanded ? 'gap-2' : 'justify-center'}`}
                      >
                        <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                          <Minus className="w-4 h-4 text-orange-500" />
                        </div>
                        {isExpanded && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm font-medium flex-1 truncate cursor-pointer">
                                  {getBoundaryDisplayName(boundary)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                {getBoundaryDisplayName(boundary)}
                              </TooltipContent>
                            </Tooltip>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 flex items-center justify-center"
                                onClick={e => {
                                  e.stopPropagation();
                                  toggleBoundaryVisibility(boundary.id);
                                }}
                                title={boundary.visible ? 'Hide boundary' : 'Show boundary'}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-red-500 hover:text-red-700 flex items-center justify-center"
                                onClick={e => {
                                  e.stopPropagation();
                                  deleteBoundary(boundary.id);
                                }}
                                title="Delete boundary"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                      {/* Expandable boundary options */}
                      {isExpanded && expandedBoundaryIds.has(boundary.id) && (
                        <div className="mt-2 space-y-3 text-xs text-gray-700 border-t pt-2">
                          {/* Zone association */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-800">Zone Association:</span>
                              {/* <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                                {boundary.zone1Id && boundary.zone2Id
                                  ? `${getZoneDisplayName(boundary.zone1Id)} to ${getZoneDisplayName(boundary.zone2Id)}`
                                  : 'Not set'}
                              </span> */}
                            </div>
                            <div className="space-y-2">
                              <select
                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs overflow-hidden"
                                value={boundary.zone1Id || ''}
                                onChange={e =>
                                  updateBoundaryZones(
                                    boundary.id,
                                    e.target.value,
                                    boundary.zone2Id || '',
                                    true
                                  )
                                }
                              >
                                <option value="">Select Zone 1</option>
                                {getAvailableZones().map(zone => (
                                  <option key={zone.id} value={zone.id}>
                                    {getZoneDisplayName(zone.id)}
                                  </option>
                                ))}
                              </select>
                              <div className="flex items-center justify-center">
                                <span className="text-gray-500 text-xs">to</span>
                              </div>
                              <select
                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs overflow-hidden"
                                value={boundary.zone2Id || ''}
                                onChange={e =>
                                  updateBoundaryZones(
                                    boundary.id,
                                    boundary.zone1Id || '',
                                    e.target.value,
                                    true
                                  )
                                }
                              >
                                <option value="">Select Zone 2</option>
                                {getAvailableZones().map(zone => (
                                  <option key={zone.id} value={zone.id}>
                                    {getZoneDisplayName(zone.id)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Presence sensor association */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-800">Presence Sensor:</span>
                              <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                                {boundary.presenceSensorId ? '1 assigned' : 'None assigned'}
                              </span>
                            </div>
                            <div className="space-y-2">
                              <select
                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                value={boundary.presenceSensorId || ''}
                                onChange={e => {
                                  const sensorId = e.target.value;
                                  if (sensorId) {
                                    handleSensorAssignment(boundary.id, sensorId);
                                  } else {
                                    removeBoundaryPresenceSensor(boundary.id);
                                  }
                                }}
                              >
                                <option value="">Select presence sensor...</option>
                                {getAllPresenceSensors().map(sensor => (
                                  <option key={sensor.id} value={sensor.id}>
                                    {sensor.name}
                                  </option>
                                ))}
                              </select>
                              {boundary.presenceSensorId && (
                                <button
                                  className="w-full px-2 py-1 text-xs text-red-600 hover:text-red-800 font-medium border border-red-300 rounded hover:bg-red-50"
                                  onClick={() => removeBoundaryPresenceSensor(boundary.id)}
                                  title="Clear sensor"
                                >
                                  Clear Sensor
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                });

                // Add the zone
                const isSelected = selectedObject?.id === zone.id;
                const isGroupExpanded = expandedGroups.has(zone.id);
                const isGroupPolygon = zone.isPolygon;

                renderItems.push(
                  <div key={zone.id} className="space-y-2">
                    <Card
                      data-object-id={zone.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      } ${zone.visible === false ? 'opacity-50' : ''} ${
                        !zone.isPolygon && !zone.containedObjects?.some(obj => obj.isPolygon)
                          ? 'bg-orange-50 border-orange-200'
                          : ''
                      } ${
                        zone.isPolygon && !zoneMixMap[zone.id]
                          ? 'bg-amber-50 border-2 border-amber-200 shadow-sm'
                          : ''
                      } ${isExpanded ? 'p-3' : 'p-2'}`}
                      onClick={() => {
                        if (!isExpanded) {
                          toggleSidebar();
                          setTimeout(() => selectObject(zone.id), 200);
                        } else {
                          selectObject(zone.id);
                        }
                      }}
                      onMouseEnter={() => {
                        if (zone.isPolygon) {
                          handleZoneHover(zone.id);
                        }
                      }}
                      onMouseLeave={() => {
                        if (zone.isPolygon) {
                          handleZoneHover(null);
                        }
                      }}
                      onDragOver={e => handleBoundaryDragOver(e, zoneIndex + 1)}
                      onDragLeave={handleBoundaryDragLeave}
                      onDrop={e => handleBoundaryDrop(e, zoneIndex + 1)}
                    >
                      <div
                        className={`flex items-center ${isExpanded ? 'gap-2' : 'justify-center'}`}
                      >
                        {isExpanded &&
                        isGroupPolygon &&
                        zone.containedObjects &&
                        zone.containedObjects.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 flex-shrink-0"
                            onClick={e => {
                              e.stopPropagation();
                              toggleGroupExpansion(zone.id);
                            }}
                            title={isGroupExpanded ? 'Collapse group' : 'Expand group'}
                          >
                            {isGroupExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        ) : isExpanded ? (
                          <div className="w-6 h-6 flex-shrink-0" />
                        ) : null}

                        <div
                          className={`flex items-center ${isExpanded ? 'gap-2 flex-1 min-w-0' : 'justify-center'}`}
                        >
                          <div className="relative group">
                            {getObjectIcon(zone.type, zone.shapeId)}
                            {!isExpanded && (
                              <div className="fixed left-16 z-50 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-lg">
                                {getDisplayName(zone)}
                                {isGroupPolygon &&
                                  zone.containedObjects &&
                                  zone.containedObjects.length > 0 && (
                                    <span className="text-gray-300 ml-1">
                                      (
                                      {
                                        zone.containedObjects.filter(
                                          obj =>
                                            obj.type !== 'text' &&
                                            obj.type !== 'i-text' &&
                                            obj.type !== 'textbox'
                                        ).length
                                      }
                                      )
                                    </span>
                                  )}
                              </div>
                            )}
                          </div>
                          {isExpanded && (
                            <>
                              {editingObjectId === zone.id ? (
                                <Input
                                  autoFocus
                                  className="text-sm font-medium flex-1 truncate bg-transparent border border-gray-300 px-1 py-0.5 h-6"
                                  value={zone.name}
                                  onChange={e => {
                                    const newName = e.target.value;
                                    setObjects(prev =>
                                      prev.map(o =>
                                        o.id === zone.id ? { ...o, name: newName } : o
                                      )
                                    );
                                    const fabricObj = canvas
                                      ?.getObjects()
                                      .find(o => o.get('id') === zone.id);
                                    fabricObj?.set('name', newName);
                                    fabricObj?.set('type', newName);
                                    canvas?.renderAll();
                                  }}
                                  onBlur={() => setEditingObjectId(null)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') setEditingObjectId(null);
                                  }}
                                />
                              ) : (
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span
                                    className="text-sm font-medium flex-1 truncate"
                                    onDoubleClick={e => {
                                      e.stopPropagation();
                                      setEditingObjectId(zone.id);
                                    }}
                                    title="Double-click to rename"
                                  >
                                    {getDisplayName(zone)}
                                    {isGroupPolygon &&
                                      zone.containedObjects &&
                                      zone.containedObjects.length > 0 && (
                                        <span className="text-gray-500 ml-1">
                                          (
                                          {
                                            zone.containedObjects.filter(
                                              obj =>
                                                obj.type !== 'text' &&
                                                obj.type !== 'i-text' &&
                                                obj.type !== 'textbox'
                                            ).length
                                          }
                                          )
                                        </span>
                                      )}
                                  </span>
                                  {isGroupPolygon && !zoneMixMap[zone.id] && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 border border-amber-300 rounded-full text-amber-700 text-xs font-medium whitespace-nowrap flex-shrink-0 cursor-help">
                                          <span>!</span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="bg-primary text-center font-medium"
                                      >
                                        <p>Mix has not been assigned to this zone</p>
                                        <p className="text-xs mt-1 opacity-90">
                                          Open zone settings to select a mix
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {isExpanded && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                              onClick={e => {
                                e.stopPropagation();
                                setEditingObjectId(zone.id);
                              }}
                              title="Edit name"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            {/* Zone-level properties dropdown */}
                            {zone.isPolygon && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                                    onClick={e => e.stopPropagation()}
                                    title="Zone settings"
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="p-2 w-72 mr-8 mt-2">
                                  <div className="space-y-3">
                                    {/* Mix select */}
                                    <div className="space-y-1">
                                      <span className="text-[10px] uppercase tracking-wide text-gray-500">
                                        Mix
                                      </span>
                                      <UiSelect
                                        value={zoneMixMap[zone.id] || ''}
                                        onValueChange={val => {
                                          setZoneMixMap(prev => ({ ...prev, [zone.id]: val }));
                                          const poly = canvas
                                            ?.getObjects()
                                            .find(o => o.get('id') === zone.id);
                                          if (poly) {
                                            poly.set('mix', val);
                                            canvas?.renderAll();
                                          }
                                        }}
                                      >
                                        <UiSelectTrigger className="w-full h-8 text-xs">
                                          <UiSelectValue placeholder="Select mix">
                                            {zoneMixMap[zone.id]
                                              ? `${zoneMixMap[zone.id]}`
                                              : 'Select mix'}
                                          </UiSelectValue>
                                        </UiSelectTrigger>
                                        <UiSelectContent>
                                          {(() => {
                                            // Get the number of layers in this zone
                                            const layerCount = zone.layers?.length || 0;

                                            // Get mixes with matching layer count
                                            const availableMixes = getMixesByLayerCount(layerCount);

                                            if (availableMixes.length === 0) {
                                              return (
                                                <div className="px-2 py-1.5 text-xs text-gray-500">
                                                  No mixes available for {layerCount} layer
                                                  {layerCount !== 1 ? 's' : ''}
                                                </div>
                                              );
                                            }

                                            return availableMixes.map(mix => (
                                              <UiSelectItem key={mix.id} value={mix.id.toString()}>
                                                {mix.id}
                                              </UiSelectItem>
                                            ));
                                          })()}
                                        </UiSelectContent>
                                      </UiSelect>
                                    </div>

                                    {/* Sight Line toggle and value */}
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase tracking-wide text-gray-500">
                                          Sight Line
                                        </span>
                                        <Switch
                                          checked={zoneSightLineEnabledMap[zone.id] ?? false}
                                          onCheckedChange={v => {
                                            setZoneSightLineEnabledMap(prev => ({
                                              ...prev,
                                              [zone.id]: Boolean(v),
                                            }));
                                            const poly = canvas
                                              ?.getObjects()
                                              .find(o => o.get('id') === zone.id);
                                            if (poly) {
                                              if (v) {
                                                // Restore previous value or default to 0.15
                                                const prevVal =
                                                  zoneSightLinePrevMap[zone.id] ?? 0.15;
                                                setZoneSightLineMap(m => ({
                                                  ...m,
                                                  [zone.id]: prevVal,
                                                }));
                                                poly.set('sightLine', prevVal);
                                              } else {
                                                // Save current value and set to 0
                                                const current = zoneSightLineMap[zone.id] ?? 0;
                                                if (current > 0) {
                                                  setZoneSightLinePrevMap(m => ({
                                                    ...m,
                                                    [zone.id]: current,
                                                  }));
                                                }
                                                setZoneSightLineMap(m => ({ ...m, [zone.id]: 0 }));
                                                poly.set('sightLine', 0);
                                              }
                                              canvas?.renderAll();
                                            }
                                          }}
                                        />
                                      </div>
                                      {zoneSightLineEnabledMap[zone.id] && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-gray-500">Value</span>
                                          <input
                                            type="number"
                                            className="w-28 h-8 text-xs border rounded px-2 py-1"
                                            step={0.01}
                                            min={0.01}
                                            max={1}
                                            value={zoneSightLineMap[zone.id] ?? 0.15}
                                            onChange={e => {
                                              const raw = parseFloat(e.target.value);
                                              const val = isNaN(raw) ? 0.15 : raw;
                                              setZoneSightLineMap(prev => ({
                                                ...prev,
                                                [zone.id]: val,
                                              }));
                                              setZoneSightLinePrevMap(prev => ({
                                                ...prev,
                                                [zone.id]: val,
                                              }));
                                              const poly = canvas
                                                ?.getObjects()
                                                .find(o => o.get('id') === zone.id);
                                              if (poly) {
                                                poly.set('sightLine', val);

                                                canvas?.renderAll();
                                              }
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>

                                    {/* Brightness Scale 0..1 */}
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase tracking-wide text-gray-500">
                                          Brightness Scale
                                        </span>
                                      </div>
                                      <input
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        className="w-full h-8 text-xs border  rounded px-2 py-1"
                                        value={zoneBrightnessScaleMap[zone.id] ?? 1}
                                        onChange={e => {
                                          const raw = parseFloat(e.target.value);
                                          const clamped = isNaN(raw)
                                            ? 1
                                            : Math.max(0, Math.min(1, raw));
                                          setZoneBrightnessScaleMap(prev => ({
                                            ...prev,
                                            [zone.id]: clamped,
                                          }));
                                          const poly = canvas
                                            ?.getObjects()
                                            .find(o => o.get('id') === zone.id);
                                          if (poly) {
                                            poly.set('brightnessScale', clamped);

                                            canvas?.renderAll();
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                              onClick={e => {
                                e.stopPropagation();
                                toggleVisibility(zone.id);
                              }}
                              title="View"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              onClick={e => {
                                e.stopPropagation();
                                deleteObject(zone.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </Card>

                    {/* Room Name Card - Only for polygons */}
                    {isExpanded && isGroupExpanded && zone.isPolygon && (
                      <Card className="p-1.5 bg-gray-50 border-gray-200">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 flex-shrink-0 flex items-center justify-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-sm"></div>
                            </div>
                            <div className="flex-1 min-w-0 flex items-center">
                              {editingObjectId === `${zone.id}-roomName` ? (
                                <Input
                                  autoFocus
                                  className="text-xs font-medium w-full truncate bg-transparent border border-gray-300 px-1 py-0.5 h-4"
                                  value={zone.roomName || ''}
                                  onChange={e => {
                                    const newRoomName = e.target.value;
                                    setObjects(prev =>
                                      prev.map(o =>
                                        o.id === zone.id ? { ...o, roomName: newRoomName } : o
                                      )
                                    );
                                    const fabricObj = canvas
                                      ?.getObjects()
                                      .find(o => o.get('id') === zone.id);
                                    if (fabricObj) {
                                      fabricObj.set('roomName', newRoomName);
                                      canvas?.renderAll();
                                      // Regenerate export IDs to update room names on components
                                      setTimeout(() => generateAndStoreExportIds(), 100);
                                    }
                                  }}
                                  onBlur={() => {
                                    setEditingObjectId(null);
                                    // Regenerate export IDs to ensure room names are updated
                                    setTimeout(() => generateAndStoreExportIds(), 100);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      setEditingObjectId(null);
                                      // Regenerate export IDs to ensure room names are updated
                                      setTimeout(() => generateAndStoreExportIds(), 100);
                                    }
                                  }}
                                  placeholder="Enter room name..."
                                />
                              ) : (
                                <span
                                  className="text-xs font-medium block truncate text-gray-600"
                                  onDoubleClick={e => {
                                    e.stopPropagation();
                                    setEditingObjectId(`${zone.id}-roomName`);
                                  }}
                                  title="Double-click to edit room name"
                                >
                                  {zone.roomName || 'No room name set'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 flex items-center justify-center"
                                onClick={e => {
                                  e.stopPropagation();
                                  setEditingObjectId(`${zone.id}-roomName`);
                                }}
                                title="Edit room name"
                              >
                                <Pencil className="w-2 h-2" />
                              </Button>
                            </div>
                          </div>
                          {/* Room Features Display */}
                          {(() => {
                            console.log('🔍 Checking zone features:', {
                              zoneId: zone.id,
                              zoneName: zone.name,
                              features: zone.features,
                              hasFeatures: !!zone.features,
                            });
                            return (
                              zone.features && (
                                <div className="flex items-start gap-1.5 ml-3.5 pl-1">
                                  <span className="text-xs text-gray-500 flex-shrink-0">
                                    Features:
                                  </span>
                                  <span className="text-xs text-gray-600 flex-1">
                                    {zone.features}
                                  </span>
                                </div>
                              )
                            );
                          })()}
                        </div>
                      </Card>
                    )}

                    {/* Show text objects and layer management when polygon is expanded */}
                    {isExpanded && isGroupExpanded && zone.isPolygon && (
                      <div className="ml-4 pl-4 border-l-2 border-gray-200 space-y-2">
                        {/* Text objects section */}
                        {zone.containedObjects && zone.containedObjects.length > 0 && (
                          <div className="space-y-1">
                            {zone.containedObjects
                              .filter(
                                obj =>
                                  obj.type === 'text' ||
                                  obj.type === 'i-text' ||
                                  obj.type === 'textbox'
                              )
                              .map(textObj => {
                                const isTextSelected = selectedObject?.id === textObj.id;
                                return (
                                  <Card
                                    key={textObj.id}
                                    data-object-id={textObj.id}
                                    className={`p-1.5 cursor-pointer transition-all duration-200 ${
                                      isTextSelected
                                        ? 'bg-blue-50 border-blue-200'
                                        : 'hover:bg-gray-50'
                                    } ${textObj.visible === false ? 'opacity-50' : ''}`}
                                    onClick={() => {
                                      selectObject(textObj.id);
                                    }}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-2.5 h-2.5 flex-shrink-0 flex items-center justify-center">
                                        {getObjectIcon(textObj.type, textObj.shapeId)}
                                      </div>
                                      <div className="flex-1 min-w-0 flex items-center">
                                        {editingObjectId === textObj.id ? (
                                          <Input
                                            autoFocus
                                            className="text-xs font-medium w-full truncate bg-transparent border border-gray-300 px-1 py-0.5 h-4"
                                            value={textObj.text || textObj.name}
                                            onChange={e => {
                                              const newText = e.target.value;
                                              setObjects(prev =>
                                                prev.map(o =>
                                                  o.id === textObj.id ? { ...o, text: newText } : o
                                                )
                                              );
                                              const fabricObj = canvas
                                                ?.getObjects()
                                                .find(o => o.get('id') === textObj.id);
                                              if (fabricObj) {
                                                fabricObj.set('text', newText);
                                                canvas?.renderAll();
                                              }
                                            }}
                                            onBlur={() => setEditingObjectId(null)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') setEditingObjectId(null);
                                            }}
                                          />
                                        ) : (
                                          <span
                                            className="text-xs font-medium block truncate"
                                            onDoubleClick={e => {
                                              e.stopPropagation();
                                              setEditingObjectId(textObj.id);
                                            }}
                                            title="Double-click to edit text"
                                          >
                                            {textObj.text || textObj.name}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 flex items-center justify-center"
                                          onClick={e => {
                                            e.stopPropagation();
                                            setEditingObjectId(textObj.id);
                                          }}
                                          title="Edit text"
                                        >
                                          <Pencil className="w-2 h-2" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 flex items-center justify-center"
                                          onClick={e => {
                                            e.stopPropagation();
                                            toggleVisibility(textObj.id);
                                          }}
                                          title="View"
                                        >
                                          <Eye className="w-2 h-2" />
                                        </Button>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                          </div>
                        )}

                        {/* Switch components section */}
                        {zone.containedObjects && zone.containedObjects.length > 0 && (
                          <div className="space-y-1">
                            {zone.containedObjects
                              .filter(obj => {
                                // Find the corresponding fabric object to check shapeCategory
                                const fabricObj = canvas
                                  ?.getObjects()
                                  .find(o => o.get('id') === obj.id);
                                return fabricObj && isSwitchObject(fabricObj);
                              })
                              .map(switchObj => {
                                const isSwitchSelected = selectedObject?.id === switchObj.id;
                                return (
                                  <Card
                                    key={switchObj.id}
                                    data-object-id={switchObj.id}
                                    className={`p-1.5 cursor-pointer transition-all duration-200 ${
                                      isSwitchSelected
                                        ? 'bg-blue-50 border-blue-200'
                                        : 'hover:bg-gray-50'
                                    } ${switchObj.visible === false ? 'opacity-50' : ''}`}
                                    onClick={() => {
                                      selectObject(switchObj.id);
                                    }}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-2.5 h-2.5 flex-shrink-0 flex items-center justify-center">
                                        {getObjectIcon(switchObj.type, switchObj.shapeId)}
                                      </div>
                                      <div className="flex-1 min-w-0 flex items-center">
                                        {editingObjectId === switchObj.id ? (
                                          <Input
                                            autoFocus
                                            className="text-xs font-medium w-full truncate bg-transparent border border-gray-300 px-1 py-0.5 h-4"
                                            value={switchObj.name}
                                            onChange={e => {
                                              const newName = e.target.value;
                                              setObjects(prev =>
                                                prev.map(o =>
                                                  o.id === switchObj.id
                                                    ? { ...o, name: newName }
                                                    : o
                                                )
                                              );
                                              const fabricObj = canvas
                                                ?.getObjects()
                                                .find(o => o.get('id') === switchObj.id);
                                              fabricObj?.set('name', newName);
                                              fabricObj?.set('type', newName);
                                              canvas?.renderAll();
                                            }}
                                            onBlur={() => setEditingObjectId(null)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') setEditingObjectId(null);
                                            }}
                                          />
                                        ) : (
                                          <span
                                            className="text-xs font-medium block truncate"
                                            onDoubleClick={e => {
                                              e.stopPropagation();
                                              setEditingObjectId(switchObj.id);
                                            }}
                                            title="Double-click to rename"
                                          >
                                            {getDisplayName(switchObj, zone.id)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 flex items-center justify-center"
                                          onClick={e => {
                                            e.stopPropagation();
                                            setEditingObjectId(switchObj.id);
                                          }}
                                          title="Edit name"
                                        >
                                          <Pencil className="w-2 h-2" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 flex items-center justify-center"
                                          onClick={e => {
                                            e.stopPropagation();
                                            toggleVisibility(switchObj.id);
                                          }}
                                          title="View"
                                        >
                                          <Eye className="w-2 h-2" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 text-red-500 hover:text-red-700 flex items-center justify-center"
                                          onClick={e => {
                                            e.stopPropagation();
                                            deleteObject(switchObj.id);
                                          }}
                                        >
                                          <Trash2 className="w-2 h-2" />
                                        </Button>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                          </div>
                        )}

                        {/* Layer management section */}
                        {zone.layers && (
                          <>
                            {/* Layer management header */}
                            <div className="flex items-center justify-between py-2">
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">Layerz</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                                onClick={e => {
                                  e.stopPropagation();
                                  addLayer(zone.id);
                                }}
                                title="Add new layer"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>

                            {/* Layers list */}
                            <div className="space-y-1">
                              {zone.layers.map(layer => {
                                const isLayerExpanded = expandedLayers.has(layer.id);
                                const layerObjects =
                                  zone.containedObjects
                                    ?.filter(
                                      obj =>
                                        layer.objectIds.includes(obj.id) &&
                                        obj.type !== 'text' &&
                                        obj.type !== 'i-text' &&
                                        obj.type !== 'textbox'
                                    )
                                    .sort((a, b) => {
                                      // Get the fabric objects to access component numbers
                                      const fabricObjA = canvas
                                        ?.getObjects()
                                        .find(o => o.get('id') === a.id);
                                      const fabricObjB = canvas
                                        ?.getObjects()
                                        .find(o => o.get('id') === b.id);

                                      const componentNumberA =
                                        fabricObjA?.get('componentNumber') || 0;
                                      const componentNumberB =
                                        fabricObjB?.get('componentNumber') || 0;

                                      // Sort by component number in ascending order
                                      return componentNumberA - componentNumberB;
                                    }) || [];

                                return (
                                  <div key={layer.id} className="space-y-1">
                                    {/* Layer header */}
                                    <Card
                                      className={`p-2 cursor-pointer transition-all duration-200 ${
                                        dragOverLayerId === layer.id
                                          ? 'bg-blue-100 border-blue-300 shadow-md scale-105'
                                          : 'hover:bg-gray-50'
                                      } ${!layer.visible ? 'opacity-50' : ''}`}
                                      onDragOver={e => handleDragOver(e, layer.id)}
                                      onDragLeave={handleDragLeave}
                                      onDrop={e => handleDrop(e, zone.id, layer.id)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 flex-shrink-0"
                                          onClick={e => {
                                            e.stopPropagation();
                                            toggleLayerExpansion(layer.id);
                                          }}
                                          title={
                                            isLayerExpanded ? 'Collapse layer' : 'Expand layer'
                                          }
                                        >
                                          {isLayerExpanded ? (
                                            <ChevronDown className="w-3 h-3" />
                                          ) : (
                                            <ChevronRight className="w-3 h-3" />
                                          )}
                                        </Button>

                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700"
                                          onClick={e => {
                                            e.stopPropagation();
                                            toggleLayerVisibility(zone.id, layer.id);
                                          }}
                                          title={layer.visible ? 'Hide layer' : 'Show layer'}
                                        >
                                          {layer.visible ? (
                                            <Eye className="w-3 h-3" />
                                          ) : (
                                            <EyeOff className="w-3 h-3" />
                                          )}
                                        </Button>

                                        <div className="flex-1 min-w-0">
                                          {editingLayerId === layer.id ? (
                                            <Input
                                              autoFocus
                                              className="text-xs font-medium w-full truncate bg-transparent border border-gray-300 px-1 py-0.5 h-4"
                                              value={editingLayerName}
                                              onChange={e => {
                                                setEditingLayerName(e.target.value);
                                              }}
                                              onBlur={() => {
                                                if (editingLayerName.trim()) {
                                                  renameLayer(
                                                    zone.id,
                                                    layer.id,
                                                    editingLayerName.trim()
                                                  );
                                                }
                                                setEditingLayerId(null);
                                                setEditingLayerName('');
                                              }}
                                              onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                  if (editingLayerName.trim()) {
                                                    renameLayer(
                                                      zone.id,
                                                      layer.id,
                                                      editingLayerName.trim()
                                                    );
                                                  }
                                                  setEditingLayerId(null);
                                                  setEditingLayerName('');
                                                } else if (e.key === 'Escape') {
                                                  setEditingLayerId(null);
                                                  setEditingLayerName('');
                                                }
                                              }}
                                            />
                                          ) : (
                                            <span
                                              className="text-xs font-medium block truncate"
                                              onDoubleClick={e => {
                                                e.stopPropagation();
                                                setEditingLayerId(layer.id);
                                                setEditingLayerName(layer.name);
                                              }}
                                              title="Double-click to rename"
                                            >
                                              <span className="text-black mr-1">
                                                {/* {getLayerPrefix(layer, zone.id)}: */}L
                                                {layer.layerId}
                                              </span>
                                              <span
                                                className={
                                                  layer.name === 'Unassigned'
                                                    ? 'px-1 rounded text-amber-700 bg-amber-100 border border-amber-200'
                                                    : ''
                                                }
                                              >
                                                {layer.name}
                                              </span>{' '}
                                              ({layerObjects.length})
                                            </span>
                                          )}
                                        </div>

                                        {/* <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700"
                                          onClick={e => {
                                            e.stopPropagation();
                                            setEditingLayerId(layer.id);
                                            setEditingLayerName(layer.name);
                                          }}
                                          title="Edit layer name"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                        </Button> */}

                                        {zone.layers && zone.layers.length > 1 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                                            onClick={e => {
                                              e.stopPropagation();
                                              deleteLayer(zone.id, layer.id);
                                            }}
                                            title="Delete layer"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                          </Button>
                                        )}
                                      </div>
                                    </Card>

                                    {/* Layer objects */}
                                    {isLayerExpanded && layerObjects.length > 0 && (
                                      <div className="ml-4 pl-2 border-l border-gray-200 space-y-1">
                                        {layerObjects.map(contained => {
                                          const isContainedSelected =
                                            selectedObject?.id === contained.id;
                                          return (
                                            <Card
                                              key={contained.id}
                                              data-object-id={contained.id}
                                              className={`p-1.5 cursor-pointer transition-all duration-200 ${
                                                isContainedSelected
                                                  ? 'bg-blue-50 border-blue-200'
                                                  : draggedObjectId === contained.id
                                                    ? 'bg-yellow-50 border-yellow-300 shadow-lg scale-105'
                                                    : 'hover:bg-gray-50'
                                              } ${contained.visible === false ? 'opacity-50' : ''}`}
                                              onClick={() => {
                                                selectObject(contained.id);
                                              }}
                                              draggable
                                              onDragStart={e => handleDragStart(e, contained.id)}
                                            >
                                              <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 flex-shrink-0 flex items-center justify-center">
                                                  {getObjectIcon(contained.type, contained.shapeId)}
                                                </div>
                                                <div className="flex-1 min-w-0 flex items-center">
                                                  {editingObjectId === contained.id ? (
                                                    <Input
                                                      autoFocus
                                                      className="text-xs font-medium w-full truncate bg-transparent border border-gray-300 px-1 py-0.5 h-4"
                                                      value={contained.name}
                                                      onChange={e => {
                                                        const newName = e.target.value;
                                                        setObjects(prev =>
                                                          prev.map(o =>
                                                            o.id === contained.id
                                                              ? { ...o, name: newName }
                                                              : o
                                                          )
                                                        );
                                                        const fabricObj = canvas
                                                          ?.getObjects()
                                                          .find(o => o.get('id') === contained.id);
                                                        fabricObj?.set('name', newName);
                                                        fabricObj?.set('type', newName);
                                                        canvas?.renderAll();
                                                      }}
                                                      onBlur={() => setEditingObjectId(null)}
                                                      onKeyDown={e => {
                                                        if (e.key === 'Enter')
                                                          setEditingObjectId(null);
                                                      }}
                                                    />
                                                  ) : (
                                                    <span
                                                      className="text-xs font-medium block truncate"
                                                      onDoubleClick={e => {
                                                        e.stopPropagation();
                                                        setEditingObjectId(contained.id);
                                                      }}
                                                      title="Double-click to rename"
                                                    >
                                                      {getDisplayName(contained, zone.id)}
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-4 w-4 p-0 text-gray-500  hover:text-gray-700 flex items-center justify-center"
                                                        onClick={e => e.stopPropagation()}
                                                        title="Select fixture"
                                                      >
                                                        <ChevronDown className="w-2 h-2" />
                                                      </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent className="p-2 w-68 mr-8 mt-2">
                                                      <div className="space-y-3">
                                                        {/* Model select */}
                                                        <div className="space-y-1">
                                                          <span className="text-[10px] uppercase tracking-wide text-gray-500">
                                                            Model
                                                          </span>
                                                          <UiSelect
                                                            value={
                                                              objectModelMap[contained.id] ??
                                                              ((canvas
                                                                ?.getObjects()
                                                                .find(
                                                                  o => o.get('id') === contained.id
                                                                )
                                                                ?.get('modelId') as string) ||
                                                                '')
                                                            }
                                                            onValueChange={val => {
                                                              setObjectModelMap(prev => ({
                                                                ...prev,
                                                                [contained.id]: val,
                                                              }));
                                                              const selected = (
                                                                fixtures || []
                                                              ).find(f => f.id === val);
                                                              const fabricObj = canvas
                                                                ?.getObjects()
                                                                .find(
                                                                  o => o.get('id') === contained.id
                                                                );
                                                              if (fabricObj && selected) {
                                                                fabricObj.set(
                                                                  'modelId',
                                                                  selected.id
                                                                );
                                                                fabricObj.set(
                                                                  'modelName',
                                                                  selected.modelName
                                                                );
                                                                fabricObj.set(
                                                                  'manufacturer',
                                                                  selected.manufacturer
                                                                );
                                                                fabricObj.set(
                                                                  'lumens',
                                                                  selected.lumens ?? null
                                                                );
                                                                fabricObj.set(
                                                                  'sizeIn',
                                                                  selected.sizeIn ?? null
                                                                );
                                                                fabricObj.set(
                                                                  'unitPrice',
                                                                  selected.price ?? null
                                                                );
                                                                // Persist fixture electrical details on the fabric object
                                                                fabricObj.set(
                                                                  'channelCount',
                                                                  selected.channelCount ?? null
                                                                );
                                                                fabricObj.set(
                                                                  'wattPower',
                                                                  selected.peakPowerW ?? null
                                                                );
                                                                const nlEnabled =
                                                                  !!objectNightlightMap[
                                                                    contained.id
                                                                  ];
                                                                const nlValue =
                                                                  objectNightlightValueMap[
                                                                    contained.id
                                                                  ] ?? 0.5;
                                                                fabricObj.set(
                                                                  'nightLight',
                                                                  nlEnabled ? nlValue : 0
                                                                );

                                                                // Save to fixture model memory for future auto-assignment
                                                                // Get fixture type from the object
                                                                const fixtureType =
                                                                  (fabricObj?.get(
                                                                    'shapeType'
                                                                  ) as string) || '';
                                                                const polygonId =
                                                                  (fabricObj?.get(
                                                                    'polygonId'
                                                                  ) as string) || '';

                                                                // Find the layer where this fixture will be placed (based on model name)
                                                                let targetLayerId = '';
                                                                if (polygonId && canvas) {
                                                                  const polygon = canvas
                                                                    .getObjects()
                                                                    .find(
                                                                      p => p.get('id') === polygonId
                                                                    );
                                                                  if (
                                                                    polygon &&
                                                                    polygon.type === 'polygon'
                                                                  ) {
                                                                    const layers =
                                                                      (polygon.get(
                                                                        'layers'
                                                                      ) as PolygonLayer[]) || [];
                                                                    // Find layer with matching model name
                                                                    const layer = layers.find(
                                                                      l =>
                                                                        l.name ===
                                                                        selected.modelName
                                                                    );
                                                                    if (layer) {
                                                                      targetLayerId = layer.id;
                                                                    }
                                                                  }
                                                                }

                                                                setFixtureModelMemory(prev => ({
                                                                  ...prev,
                                                                  [fixtureType]: {
                                                                    modelName: selected.modelName,
                                                                    layerId: targetLayerId,
                                                                  },
                                                                }));

                                                                canvas?.renderAll();

                                                                // Rebuild grouping so layers reflect model-based grouping immediately
                                                                setTimeout(() => {
                                                                  if (!canvas) return;
                                                                  const canvasObjects = canvas
                                                                    .getObjects()
                                                                    .filter(
                                                                      obj =>
                                                                        obj.type !== 'image' &&
                                                                        obj.get('id')
                                                                    );

                                                                  const nameCounts: Record<
                                                                    string,
                                                                    number
                                                                  > = {};
                                                                  const objectsList: CanvasObject[] =
                                                                    canvasObjects.map(obj => {
                                                                      const baseName =
                                                                        getObjectName(obj);
                                                                      nameCounts[baseName] =
                                                                        (nameCounts[baseName] ||
                                                                          0) + 1;
                                                                      const finalName =
                                                                        obj.type === 'polygon'
                                                                          ? nameCounts[baseName] ===
                                                                            1
                                                                            ? baseName
                                                                            : `${baseName} ${nameCounts[baseName] - 1}`
                                                                          : `${baseName} ${nameCounts[baseName]}`;

                                                                      let overlayColor =
                                                                        typeof obj.fill === 'string'
                                                                          ? obj.fill
                                                                          : '#000000';
                                                                      let overlayOpacity =
                                                                        obj.get('opacity') || 1;

                                                                      if (
                                                                        obj.type === 'group' &&
                                                                        'getObjects' in obj
                                                                      ) {
                                                                        const group =
                                                                          obj as fabric.Group;
                                                                        const overlayItem = group
                                                                          .getObjects()
                                                                          .find(child => {
                                                                            const category =
                                                                              child.get(
                                                                                'shapeCategory'
                                                                              ) as ComponentType;
                                                                            return (
                                                                              category ===
                                                                                ComponentType.Overlay &&
                                                                              child.visible !==
                                                                                false
                                                                            );
                                                                          });

                                                                        if (overlayItem) {
                                                                          overlayColor =
                                                                            typeof overlayItem.fill ===
                                                                            'string'
                                                                              ? overlayItem.fill
                                                                              : '#000000';
                                                                          overlayOpacity =
                                                                            overlayItem.opacity ||
                                                                            1;
                                                                        }
                                                                      }

                                                                      return {
                                                                        id: obj.get('id'),
                                                                        type: obj.type || 'unknown',
                                                                        name:
                                                                          finalName ||
                                                                          obj.get('name'),
                                                                        roomName:
                                                                          obj.get('roomName'),
                                                                        color: overlayColor,
                                                                        strokeColor:
                                                                          typeof obj.stroke ===
                                                                          'string'
                                                                            ? obj.stroke
                                                                            : '#000000',
                                                                        strokeWidth:
                                                                          obj.strokeWidth || 1,
                                                                        width: obj.width,
                                                                        height: obj.height,
                                                                        left: obj.left,
                                                                        top: obj.top,
                                                                        angle: obj.angle,
                                                                        scaleX: obj.scaleX,
                                                                        scaleY: obj.scaleY,
                                                                        fontSize:
                                                                          obj.get('fontSize'),
                                                                        text: obj.get('text'),
                                                                        visible: obj.visible,
                                                                        opacity: overlayOpacity,
                                                                        shapeId: obj.get('shapeId'),
                                                                      } as CanvasObject;
                                                                    });

                                                                  // Get the current count of MODEL-NAMED layers (excluding "Unassigned" special layer)
                                                                  const currentZoneObj =
                                                                    groupedObjects.find(
                                                                      g => g.id === zone.id
                                                                    );
                                                                  const oldModelLayerCount =
                                                                    (
                                                                      currentZoneObj?.layers || []
                                                                    ).filter(
                                                                      l => l.name !== 'Unassigned'
                                                                    ).length || 0;

                                                                  const updatedGrouped =
                                                                    reconstructLayersFromObjects(
                                                                      objectsList
                                                                    );

                                                                  // Check if the count of MODEL-NAMED layers changed (excluding "Unassigned")
                                                                  const updatedZoneObj =
                                                                    updatedGrouped.find(
                                                                      g => g.id === zone.id
                                                                    );
                                                                  const newModelLayerCount =
                                                                    (
                                                                      updatedZoneObj?.layers || []
                                                                    ).filter(
                                                                      l => l.name !== 'Unassigned'
                                                                    ).length || 0;

                                                                  // Reset mix only if MODEL-NAMED layer count changed (not affected by "Unassigned")
                                                                  if (
                                                                    newModelLayerCount !==
                                                                    oldModelLayerCount
                                                                  ) {
                                                                    // Find the zone polygon on the canvas and reset mix
                                                                    const zoneId = zone.id;
                                                                    const polygonObj = canvas
                                                                      .getObjects()
                                                                      .find(
                                                                        p =>
                                                                          p.type === 'polygon' &&
                                                                          p.get('id') === zoneId
                                                                      );
                                                                    if (polygonObj) {
                                                                      polygonObj.set('mix', '');
                                                                      // Delete from map to show warning
                                                                      setZoneMixMap(prev => {
                                                                        const newMap = { ...prev };
                                                                        delete newMap[zoneId];
                                                                        return newMap;
                                                                      });
                                                                    }
                                                                  }

                                                                  setGroupedObjects(updatedGrouped);
                                                                  setTimeout(
                                                                    () =>
                                                                      generateAndStoreExportIds(),
                                                                    100
                                                                  );
                                                                }, 0);
                                                              }
                                                            }}
                                                          >
                                                            <UiSelectTrigger className="w-full h-8 text-xs">
                                                              <UiSelectValue placeholder="Select model" />
                                                            </UiSelectTrigger>
                                                            <UiSelectContent>
                                                              {getFixturesForShape(
                                                                contained.shapeId
                                                              ).map(f => (
                                                                <UiSelectItem
                                                                  key={f.id}
                                                                  value={f.id}
                                                                >
                                                                  {f.modelName}
                                                                </UiSelectItem>
                                                              ))}
                                                            </UiSelectContent>
                                                          </UiSelect>
                                                        </div>

                                                        {/* Auto-filled details from selection */}
                                                        {(() => {
                                                          const fabricObj = canvas
                                                            ?.getObjects()
                                                            .find(
                                                              o => o.get('id') === contained.id
                                                            );
                                                          const selectedId =
                                                            objectModelMap[contained.id] ??
                                                            ((fabricObj?.get(
                                                              'modelId'
                                                            ) as string) ||
                                                              undefined);
                                                          const selected = (fixtures || []).find(
                                                            f => f.id === selectedId
                                                          );
                                                          const manufacturer =
                                                            selected?.manufacturer ??
                                                            ((fabricObj?.get(
                                                              'manufacturer'
                                                            ) as string) ||
                                                              '');
                                                          const lumens =
                                                            selected?.lumens ??
                                                            (fabricObj?.get('lumens') as
                                                              | number
                                                              | undefined);
                                                          return (
                                                            <div className="grid grid-cols-2 gap-2">
                                                              <div>
                                                                <span className="block text-[10px] uppercase tracking-wide text-gray-500">
                                                                  Manufacturer
                                                                </span>
                                                                <div className="text-xs font-medium text-gray-800 border rounded px-2 py-1 h-8 flex items-center">
                                                                  {manufacturer || '—'}
                                                                </div>
                                                              </div>
                                                              <div>
                                                                <span className="block text-[10px] uppercase tracking-wide text-gray-500">
                                                                  Lumens
                                                                </span>
                                                                <div className="text-xs font-medium text-gray-800 border rounded px-2 py-1 h-8 flex items-center">
                                                                  {typeof lumens === 'number'
                                                                    ? lumens
                                                                    : '—'}
                                                                </div>
                                                              </div>
                                                            </div>
                                                          );
                                                        })()}

                                                        {/* Nightlight toggle and value */}
                                                        <div className="space-y-1 pt-1">
                                                          <div className="flex items-center justify-between">
                                                            <span className="text-[10px] uppercase tracking-wide text-gray-500">
                                                              Nightlight
                                                            </span>
                                                            <Switch
                                                              checked={
                                                                objectNightlightMap[contained.id] ??
                                                                false
                                                              }
                                                              onCheckedChange={v => {
                                                                setObjectNightlightMap(prev => ({
                                                                  ...prev,
                                                                  [contained.id]: Boolean(v),
                                                                }));
                                                                if (
                                                                  v &&
                                                                  objectNightlightValueMap[
                                                                    contained.id
                                                                  ] === undefined
                                                                ) {
                                                                  setObjectNightlightValueMap(
                                                                    prev => ({
                                                                      ...prev,
                                                                      [contained.id]: 0.5,
                                                                    })
                                                                  );
                                                                }
                                                                const fabricObj = canvas
                                                                  ?.getObjects()
                                                                  .find(
                                                                    o =>
                                                                      o.get('id') === contained.id
                                                                  );
                                                                if (fabricObj) {
                                                                  const nlValue =
                                                                    objectNightlightValueMap[
                                                                      contained.id
                                                                    ] ?? 0.5;
                                                                  fabricObj.set(
                                                                    'nightLight',
                                                                    v ? nlValue : 0
                                                                  );
                                                                  canvas?.renderAll();
                                                                }
                                                              }}
                                                            />
                                                          </div>
                                                          {objectNightlightMap[contained.id] && (
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-[10px] text-gray-500">
                                                                Value
                                                              </span>
                                                              <input
                                                                type="number"
                                                                min={0}
                                                                max={1}
                                                                step={0.1}
                                                                className="w-20 h-8 text-xs border rounded px-2 py-1"
                                                                value={
                                                                  objectNightlightValueMap[
                                                                    contained.id
                                                                  ] ?? 0.5
                                                                }
                                                                onChange={e => {
                                                                  const raw = parseFloat(
                                                                    e.target.value
                                                                  );
                                                                  const clamped = isNaN(raw)
                                                                    ? 0
                                                                    : Math.max(0, Math.min(1, raw));
                                                                  setObjectNightlightValueMap(
                                                                    prev => ({
                                                                      ...prev,
                                                                      [contained.id]: clamped,
                                                                    })
                                                                  );
                                                                  const fabricObj = canvas
                                                                    ?.getObjects()
                                                                    .find(
                                                                      o =>
                                                                        o.get('id') === contained.id
                                                                    );
                                                                  if (
                                                                    fabricObj &&
                                                                    objectNightlightMap[
                                                                      contained.id
                                                                    ]
                                                                  ) {
                                                                    fabricObj.set(
                                                                      'nightLight',
                                                                      clamped
                                                                    );
                                                                    canvas?.renderAll();
                                                                  }
                                                                }}
                                                              />
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </DropdownMenuContent>
                                                  </DropdownMenu>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 flex items-center justify-center"
                                                    onClick={e => {
                                                      e.stopPropagation();
                                                      setEditingObjectId(contained.id);
                                                    }}
                                                    title="Edit name"
                                                  >
                                                    <Pencil className="w-2 h-2" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 flex items-center justify-center"
                                                    onClick={e => {
                                                      e.stopPropagation();
                                                      toggleVisibility(contained.id);
                                                    }}
                                                    title="View"
                                                  >
                                                    <Eye className="w-2 h-2" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-4 w-4 p-0 text-red-500 hover:text-red-700 flex items-center justify-center"
                                                    onClick={e => {
                                                      e.stopPropagation();
                                                      deleteObject(contained.id);
                                                    }}
                                                  >
                                                    <Trash2 className="w-2 h-2" />
                                                  </Button>
                                                </div>
                                              </div>
                                            </Card>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Empty layer message */}
                                    {isLayerExpanded && layerObjects.length === 0 && (
                                      <div className="ml-4 pl-2 border-l border-gray-200">
                                        <p className="text-xs text-gray-400 py-1">
                                          No objects in this layer
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              });

              // Add boundaries after the last zone
              const boundariesAfterLastZone = sortedBoundaries.filter(
                b => b.position === zoneObjects.length
              );
              // Drop indicator after the last zone
              if (dragOverBoundaryPosition === zoneObjects.length) {
                renderItems.push(
                  <div key={`drop-indicator-after-last`} className="px-2">
                    <div className="h-0.5 bg-blue-500 rounded-full my-1" />
                  </div>
                );
              }
              boundariesAfterLastZone.forEach(boundary => {
                const isBoundarySelected = selectedObject?.id === boundary.id;
                renderItems.push(
                  <Card
                    key={`boundary-${boundary.id}`}
                    data-object-id={boundary.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      isBoundarySelected
                        ? 'bg-blue-50 border-blue-200'
                        : draggedBoundaryId === boundary.id
                          ? 'bg-yellow-50 border-yellow-300 shadow-lg scale-105'
                          : 'hover:bg-gray-50'
                    } ${boundary.visible === false ? 'opacity-50' : ''} ${
                      isExpanded ? 'p-2' : 'p-1'
                    }`}
                    onClick={e => handleBoundaryCardClick(e, boundary.id)}
                    draggable
                    onDragStart={e => handleBoundaryDragStart(e, boundary.id)}
                  >
                    <div className={`flex items-center ${isExpanded ? 'gap-2' : 'justify-center'}`}>
                      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                        <Minus className="w-4 h-4 text-orange-500" />
                      </div>
                      {isExpanded && (
                        <>
                          <span className="text-sm font-medium flex-1 truncate">
                            {getBoundaryDisplayName(boundary)}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 flex items-center justify-center"
                              onClick={e => {
                                e.stopPropagation();
                                toggleBoundaryVisibility(boundary.id);
                              }}
                              title={boundary.visible ? 'Hide boundary' : 'Show boundary'}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-red-500 hover:text-red-700 flex items-center justify-center"
                              onClick={e => {
                                e.stopPropagation();
                                deleteBoundary(boundary.id);
                              }}
                              title="Delete boundary"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Expandable boundary options */}
                    {isExpanded && expandedBoundaryIds.has(boundary.id) && (
                      <div className="mt-2 space-y-3 text-xs text-gray-700 border-t pt-2">
                        {/* Zone association */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800">Zone Association:</span>
                            <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                              {boundary.zone1Id && boundary.zone2Id
                                ? `${getZoneDisplayName(boundary.zone1Id)} to ${getZoneDisplayName(boundary.zone2Id)}`
                                : 'Not set'}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <select
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs overflow-hidden"
                              value={boundary.zone1Id || ''}
                              onChange={e =>
                                updateBoundaryZones(
                                  boundary.id,
                                  e.target.value,
                                  boundary.zone2Id || '',
                                  true
                                )
                              }
                            >
                              <option value="">Select Zone 1</option>
                              {getAvailableZones().map(zone => (
                                <option key={zone.id} value={zone.id}>
                                  {getZoneDisplayName(zone.id)}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center justify-center">
                              <span className="text-gray-500 text-xs">to</span>
                            </div>
                            <select
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs overflow-hidden"
                              value={boundary.zone2Id || ''}
                              onChange={e =>
                                updateBoundaryZones(
                                  boundary.id,
                                  boundary.zone1Id || '',
                                  e.target.value,
                                  true
                                )
                              }
                            >
                              <option value="">Select Zone 2</option>
                              {getAvailableZones().map(zone => (
                                <option key={zone.id} value={zone.id}>
                                  {getZoneDisplayName(zone.id)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Presence sensor association */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800">Presence Sensor:</span>
                            <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                              {boundary.presenceSensorId ? '1 assigned' : 'None assigned'}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <select
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                              value={boundary.presenceSensorId || ''}
                              onChange={e => {
                                const sensorId = e.target.value;
                                if (sensorId) {
                                  handleSensorAssignment(boundary.id, sensorId);
                                } else {
                                  removeBoundaryPresenceSensor(boundary.id);
                                }
                              }}
                            >
                              <option value="">Select presence sensor...</option>
                              {getAllPresenceSensors().map(sensor => (
                                <option key={sensor.id} value={sensor.id}>
                                  {sensor.name}
                                </option>
                              ))}
                            </select>
                            {boundary.presenceSensorId && (
                              <button
                                className="w-full px-2 py-1 text-xs text-red-600 hover:text-red-800 font-medium border border-red-300 rounded hover:bg-red-50"
                                onClick={() => removeBoundaryPresenceSensor(boundary.id)}
                                title="Clear sensor"
                              >
                                Clear Sensor
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              });

              // Add standalone objects (objects outside polygons)
              standaloneObjects.forEach(standaloneObj => {
                const isSelected = selectedObject?.id === standaloneObj.id;
                renderItems.push(
                  <Card
                    key={standaloneObj.id}
                    data-object-id={standaloneObj.id}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                    } ${standaloneObj.visible === false ? 'opacity-50' : ''} ${
                      isExpanded ? 'p-3' : 'p-2'
                    } bg-orange-50 border-orange-200`}
                    onClick={() => {
                      if (!isExpanded) {
                        toggleSidebar();
                        setTimeout(() => selectObject(standaloneObj.id), 200);
                      } else {
                        selectObject(standaloneObj.id);
                      }
                    }}
                  >
                    <div className={`flex items-center ${isExpanded ? 'gap-2' : 'justify-center'}`}>
                      <div className="relative group">
                        {getObjectIcon(standaloneObj.type, standaloneObj.shapeId)}
                        {!isExpanded && (
                          <div className="fixed left-16 z-50 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-lg">
                            {getDisplayName(standaloneObj)}
                          </div>
                        )}
                      </div>
                      {isExpanded && (
                        <>
                          {editingObjectId === standaloneObj.id ? (
                            <Input
                              autoFocus
                              className="text-sm font-medium flex-1 truncate bg-transparent border border-gray-300 px-1 py-0.5 h-6"
                              value={standaloneObj.name}
                              onChange={e => {
                                const newName = e.target.value;
                                setObjects(prev =>
                                  prev.map(o =>
                                    o.id === standaloneObj.id ? { ...o, name: newName } : o
                                  )
                                );
                                const fabricObj = canvas
                                  ?.getObjects()
                                  .find(o => o.get('id') === standaloneObj.id);
                                fabricObj?.set('name', newName);
                                fabricObj?.set('type', newName);
                                canvas?.renderAll();
                              }}
                              onBlur={() => setEditingObjectId(null)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') setEditingObjectId(null);
                              }}
                            />
                          ) : (
                            <span
                              className="text-sm font-medium flex-1 truncate"
                              onDoubleClick={e => {
                                e.stopPropagation();
                                setEditingObjectId(standaloneObj.id);
                              }}
                              title="Double-click to rename"
                            >
                              {getDisplayName(standaloneObj)}
                            </span>
                          )}
                        </>
                      )}

                      {isExpanded && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                            onClick={e => {
                              e.stopPropagation();
                              setEditingObjectId(standaloneObj.id);
                            }}
                            title="Edit name"
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                            onClick={e => {
                              e.stopPropagation();
                              toggleVisibility(standaloneObj.id);
                            }}
                            title="View"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            onClick={e => {
                              e.stopPropagation();
                              deleteObject(standaloneObj.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              });

              return renderItems;
            }, [
              groupedObjects,
              boundaries,
              dragOverBoundaryPosition,
              selectedObject,
              expandedGroups,
              expandedBoundaryIds,
              expandedLayers,
              draggedObjectId,
              draggedBoundaryId,
              dragOverLayerId,
              editingObjectId,
              isExpanded,
              canvas,
              zoneMixMap,
              zoneSightLineMap,
              zoneSightLineEnabledMap,
              zoneBrightnessScaleMap,
              objectNightlightMap,
              objectNightlightValueMap,
            ])}

            {groupedObjects.length === 0 && (
              <p className={`text-sm text-gray-500 text-center py-4 ${isExpanded ? '' : 'hidden'}`}>
                No components on canvas
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Object Control Bar Component */}
      {selectedObject && (
        <ObjectControlBar
          selectedObject={selectedObject}
          canvas={canvas}
          isMultipleSelection={isMultipleSelection}
          setObjects={setObjects}
          setSelectedObject={setSelectedObject}
        />
      )}
    </>
  );
};

export default CanvasSidebar;
