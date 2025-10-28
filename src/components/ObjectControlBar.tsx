import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import CustomColorPicker from '@/components/ui/CustomColorPicker';
import { toast } from 'sonner';
import {
  MoveUp,
  MoveDown,
  Sparkles,
  Layers2,
  Layers3,
  Palette,
  CircleDot,
  Lightbulb,
  X,
} from 'lucide-react';
import * as fabric from 'fabric';
import { CanvasObject, LightingData } from '@/types/interfaces';
import { useLightingSuggestion } from '@/hooks/useLightingSuggestion';
import { extractJsonFromResponse } from '@/lib/utils';
import { useFabricShapes } from '@/hooks/useFabricOperations';
import { useProjects } from '@/hooks/useProjects';
import { useParams } from 'next/navigation';
import { ComponentType } from '@/utils/enum';
import { getNameById } from '@/@data/sidebar';
import { useDispatch, useSelector } from 'react-redux';
import { setShapeSize } from '@/store/slices/canvasSlice';
import { RootState } from '@/types/redux';

interface ObjectControlBarProps {
  selectedObject: CanvasObject;
  canvas: fabric.Canvas | null;
  isMultipleSelection: boolean;
  setObjects: React.Dispatch<React.SetStateAction<CanvasObject[]>>;
  setSelectedObject: React.Dispatch<React.SetStateAction<CanvasObject | null>>;
}

const ObjectControlBar: React.FC<ObjectControlBarProps> = ({
  selectedObject,
  canvas,
  isMultipleSelection,
  setObjects,
  setSelectedObject,
}) => {
  const [currentGroupSize, setCurrentGroupSize] = useState<string>('');
  const [isEditingSize, setIsEditingSize] = useState<boolean>(false);
  const [showReason, setShowReason] = useState<boolean>(false);
  const { getLightingSuggestion, isLoadingLighting } = useLightingSuggestion();
  const ref = useRef<CanvasObject>(selectedObject);

  // Redux hooks
  const dispatch = useDispatch();
  const { shapeSizes, pixelToFeetRatio: runtimePixelToFeetRatio } = useSelector(
    (state: RootState) => state.canvasReducer
  );

  // Project data access
  const { useProject } = useProjects();
  const params = useParams();
  const projectId = params.projectId as string;
  const { data: project } = useProject(projectId);
  const pixelToFeetRatio =
    (runtimePixelToFeetRatio ?? null) !== null
      ? (runtimePixelToFeetRatio as number)
      : project?.pixelToFeetRatio || null;
  const {
    addGlowingCircle,
    addCircleWithArrowOut,
    presenceSensor,
    addArrowShape,
    addGlowingRectangle,
    addParallelLines,
    addLetterDShape,
    addCircleX,
  } = useFabricShapes();

  const [colorPickerState, setColorPickerState] = useState<{
    isOpen: boolean;
    type: 'fill' | 'stroke';
    objectId: string | null;
    initialColor: string;
    isOverlay: boolean;
  }>({
    isOpen: false,
    type: 'fill',
    objectId: null,
    initialColor: '#000000',
    isOverlay: false,
  });

  const [strokeOptionsState, setStrokeOptionsState] = useState<{
    isOpen: boolean;
    objectId: string | null;
  }>({
    isOpen: false,
    objectId: null,
  });

  useEffect(() => {
    if (ref.current.id !== selectedObject.id) {
      // Only reset currentGroupSize if switching to a resizable group
      if (selectedObject.type === 'group') {
        // Check if it's a resizable group by checking shapeId
        const obj = canvas?.getObjects().find(o => o.get('id') === selectedObject.id);
        if (obj && obj.type === 'group') {
          const group = obj as fabric.Group;
          const shapeId = group.get('shapeId');
          if (shapeId && [1, 2, 3, 4, 8, 15, 16, 17, 18, 5, 6].includes(shapeId)) {
            // Calculate current size based on shapeId
            let currentSize = 0;
            if ([1, 2, 3, 4, 8, 15, 16, 17, 18].includes(shapeId)) {
              const circleElement = group
                .getObjects()
                .find(
                  (child: fabric.Object) =>
                    child.type === 'circle' && child.get('shapeCategory') !== 'overlay'
                ) as fabric.Circle;
              if (circleElement) {
                const scaleX = group.scaleX || 1;
                const scaleY = group.scaleY || 1;
                const baseRadius = circleElement.radius || 50;
                currentSize = Math.round(baseRadius * Math.min(scaleX, scaleY) * 2);
              } else {
                const scaleX = group.scaleX || 1;
                const scaleY = group.scaleY || 1;
                const baseRadius = 50;
                currentSize = Math.round(baseRadius * Math.min(scaleX, scaleY) * 2);
              }
            } else if ([5, 6].includes(shapeId)) {
              const lineElement = group
                .getObjects()
                .find(
                  (child: fabric.Object) =>
                    (child.type === 'line' || child.type === 'rect') &&
                    child.get('shapeCategory') !== 'overlay'
                ) as fabric.Line;
              if (lineElement) {
                const scaleX = group.scaleX || 1;
                const baseLength = lineElement.get('width') || 200;
                currentSize = Math.round(baseLength * scaleX);
              } else {
                const scaleX = group.scaleX || 1;
                const baseLength = 200;
                currentSize = Math.round(baseLength * scaleX);
              }
            }

            // Convert to inches
            if (pixelToFeetRatio) {
              const sizeInInches = Math.round((currentSize / pixelToFeetRatio) * 12);
              setCurrentGroupSize(sizeInInches.toString());
            } else {
              setCurrentGroupSize(currentSize.toString());
            }
          } else {
            setCurrentGroupSize('');
          }
        } else {
          setCurrentGroupSize('');
        }
      } else {
        setCurrentGroupSize('');
      }
      ref.current = selectedObject;
    }
  }, [selectedObject, canvas, pixelToFeetRatio]);

  // Function to get current size of a group based on shapeId
  const getGroupSize = useCallback(
    (objectId: string): number => {
      if (!canvas) return 0;

      const obj = canvas.getObjects().find(o => o.get('id') === objectId);
      if (!obj || obj.type !== 'group') return 0;

      const group = obj as fabric.Group;
      const shapeId = group.get('shapeId');

      if (!shapeId) return 0;

      if ([1, 2, 3, 4, 8, 15, 16, 17, 18].includes(shapeId)) {
        // For chandelier (18), look for circles without shape category; for others, look for circle with shape category
        let baseElement: fabric.Object | undefined;
        if (shapeId === 18) {
          // Chandelier has multiple circles without shape category
          baseElement = group
            .getObjects()
            .find(child => child.type === 'circle' && !child.get('shapeCategory'));
        } else {
          // Other circle-based shapes (including sconce wash with invisible circle)
          baseElement = group
            .getObjects()
            .find(child => child.type === 'circle' && child.get('shapeCategory') !== 'overlay');
        }

        if (baseElement) {
          const scaleX = group.scaleX || 1;
          const scaleY = group.scaleY || 1;
          const baseRadius = (baseElement as fabric.Circle).radius || 50;

          return Math.round(baseRadius * Math.min(scaleX, scaleY) * 2);
        }

        const scaleX = group.scaleX || 1;
        const scaleY = group.scaleY || 1;
        const baseRadius = 50;
        return Math.round(baseRadius * Math.min(scaleX, scaleY) * 2);
      } else if ([5, 6].includes(shapeId)) {
        const lineElement = group
          .getObjects()
          .find(
            child =>
              (child.type === 'line' || child.type === 'rect') &&
              child.get('shapeCategory') !== 'overlay'
          ) as fabric.Line;
        if (lineElement) {
          const scaleX = group.scaleX || 1;
          const baseLength = lineElement.get('width') || 200;
          return Math.round(baseLength * scaleX);
        }
        const scaleX = group.scaleX || 1;
        const baseLength = 200;
        return Math.round(baseLength * scaleX);
      }

      return 0;
    },
    [canvas]
  );

  // Function to check if object is a resizable group
  const isResizableGroup = useCallback(
    (objectId: string): boolean => {
      if (!canvas) return false;

      const obj = canvas.getObjects().find(o => o.get('id') === objectId);
      if (!obj || obj.type !== 'group') return false;

      const shapeId = obj.get('shapeId');
      return shapeId && [1, 2, 3, 4, 8, 15, 16, 17, 18, 5, 6].includes(shapeId);
    },
    [canvas]
  );

  // Function to check if a group has visible overlay items
  const hasVisibleOverlayItems = (obj: fabric.Object): boolean => {
    if (obj.type === 'group' && 'getObjects' in obj) {
      const group = obj as fabric.Group;
      return group.getObjects().some(child => {
        const category = child.get('shapeCategory') as ComponentType;
        return category === ComponentType.Overlay && child.visible !== false;
      });
    }
    return false;
  };

  // Object control functions
  const updateObjectColor = (objectId: string, color: string) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
    if (obj) {
      obj.set('fill', color);
      canvas.requestRenderAll();

      setObjects(prev => prev.map(o => (o.id === objectId ? { ...o, color } : o)));
      if (selectedObject?.id === objectId) {
        setSelectedObject(prev => (prev ? { ...prev, color } : null));
      }
    }
  };

  const updateObjectStrokeColor = (objectId: string, color: string) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
    if (obj) {
      obj.set('stroke', color);
      canvas.requestRenderAll();

      setObjects(prev => prev.map(o => (o.id === objectId ? { ...o, strokeColor: color } : o)));
      if (selectedObject?.id === objectId) {
        setSelectedObject(prev => (prev ? { ...prev, strokeColor: color } : null));
      }
    }
  };

  const updateObjectStrokeWidth = (objectId: string, strokeWidth: number) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
    if (obj) {
      obj.set('strokeWidth', strokeWidth);
      canvas.requestRenderAll();

      setObjects(prev => prev.map(o => (o.id === objectId ? { ...o, strokeWidth } : o)));
      if (selectedObject?.id === objectId) {
        setSelectedObject(prev => (prev ? { ...prev, strokeWidth } : null));
      }
    }
  };

  // Function to update group size based on shapeId
  const updateGroupSize = (objectId: string, newSize: number) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
    if (!obj || obj.type !== 'group') return;

    const group = obj as fabric.Group;
    const shapeId = group.get('shapeId');

    if (!shapeId) return;

    const currentScaleX = group.scaleX || 1;
    const currentScaleY = group.scaleY || 1;

    let newScaleX = currentScaleX;
    let newScaleY = currentScaleY;

    if ([1, 2, 3, 4, 8, 15, 16, 17, 18].includes(shapeId)) {
      // For chandelier (18), look for circles without shape category; for others, look for circle with shape category
      let baseElement: fabric.Object | undefined;
      if (shapeId === 18) {
        // Chandelier has multiple circles without shape category
        baseElement = group
          .getObjects()
          .find(child => child.type === 'circle' && !child.get('shapeCategory'));
      } else {
        // Other circle-based shapes (including sconce wash with invisible circle)
        baseElement = group
          .getObjects()
          .find(child => child.type === 'circle' && child.get('shapeCategory') !== 'overlay');
      }

      if (baseElement) {
        const baseRadius = (baseElement as fabric.Circle).radius || 50;

        const currentEffectiveDiameter = baseRadius * Math.min(currentScaleX, currentScaleY) * 2;
        const scaleFactor = newSize / currentEffectiveDiameter;
        newScaleX = currentScaleX * scaleFactor;
        newScaleY = currentScaleY * scaleFactor;
      } else {
        const baseRadius = 50;
        const currentEffectiveDiameter = baseRadius * Math.min(currentScaleX, currentScaleY) * 2;
        const scaleFactor = newSize / currentEffectiveDiameter;
        newScaleX = currentScaleX * scaleFactor;
        newScaleY = currentScaleY * scaleFactor;
      }
    } else if ([5, 6].includes(shapeId)) {
      const lineElement = group
        .getObjects()
        .find(
          child =>
            child.type === 'line' ||
            (child.type === 'rect' && child.get('shapeCategory') !== 'overlay')
        ) as fabric.Line;
      const baseLength = (lineElement && lineElement.get('width')) || 200;
      const scaleFactor = newSize / baseLength;
      newScaleX = scaleFactor;
      // Only length changes: Pendant (5) and Tape (6) must not scale Y
      newScaleY = 1;
    }

    group.set({
      scaleX: newScaleX,
      scaleY: newScaleY,
    });

    canvas.requestRenderAll();

    // Save the size to Redux store
    dispatch(setShapeSize({ shapeId, size: newSize }));

    setObjects(prev =>
      prev.map(o =>
        o.id === objectId
          ? {
              ...o,
              scaleX: newScaleX,
              scaleY: newScaleY,
              width: o.width ? o.width * newScaleX : o.width,
              height: o.height ? o.height * newScaleY : o.height,
            }
          : o
      )
    );

    if (selectedObject?.id === objectId) {
      setSelectedObject(prev =>
        prev
          ? {
              ...prev,
              scaleX: newScaleX,
              scaleY: newScaleY,
              width: prev.width ? prev.width * newScaleX : prev.width,
              height: prev.height ? prev.height * newScaleY : prev.height,
            }
          : null
      );
    }
  };

  const updateFontSize = (objectId: string, fontSize: number) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
    if (obj && (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox')) {
      obj.set('fontSize', fontSize);
      canvas.requestRenderAll();

      setObjects(prev => prev.map(o => (o.id === objectId ? { ...o, fontSize } : o)));
      if (selectedObject?.id === objectId) {
        setSelectedObject(prev => (prev ? { ...prev, fontSize } : null));
      }
    }
  };

  // Function to update overlay color
  const updateOverlayColor = (objectId: string, color: string) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
    if (obj && obj.type === 'group' && 'getObjects' in obj) {
      const group = obj as fabric.Group;
      group.getObjects().forEach(child => {
        const category = child.get('shapeCategory') as ComponentType;
        if (category === ComponentType.Overlay && child.visible !== false) {
          child.set('fill', color);
        }
      });
      canvas.requestRenderAll();

      setObjects(prev => prev.map(o => (o.id === objectId ? { ...o, color } : o)));
      if (selectedObject?.id === objectId) {
        setSelectedObject(prev => (prev ? { ...prev, color } : null));
      }
    }
  };

  // Function to update overlay opacity
  const updateOverlayOpacity = (objectId: string, opacity: number) => {
    if (!canvas) return;

    const obj = canvas.getObjects().find(o => o.get('id') === objectId);
    if (obj && obj.type === 'group' && 'getObjects' in obj) {
      const group = obj as fabric.Group;
      group.getObjects().forEach(child => {
        const category = child.get('shapeCategory') as ComponentType;
        if (category === ComponentType.Overlay && child.visible !== false) {
          child.set('opacity', opacity);
        }
      });
      canvas.requestRenderAll();

      setObjects(prev => prev.map(o => (o.id === objectId ? { ...o, opacity } : o)));
      if (selectedObject?.id === objectId) {
        setSelectedObject(prev => (prev ? { ...prev, opacity } : null));
      }
    }
  };

  // Check if selected object has a reason
  const hasReason = (): boolean => {
    if (!selectedObject || !canvas) return false;
    const obj = canvas.getObjects().find(o => o.get('id') === selectedObject.id);
    return obj ? !!obj.get('reason') : false;
  };

  // Get reason from selected object
  const getSelectedObjectReason = (): string => {
    if (!selectedObject || !canvas) return '';
    const obj = canvas.getObjects().find(o => o.get('id') === selectedObject.id);
    return obj ? obj.get('reason') || '' : '';
  };

  // Function to calculate default size based on pixel-to-feet ratio
  const getDefaultSize = (shapeId: number): number => {
    // Check if we have a saved size for this shape
    if (shapeSizes[shapeId]) {
      return shapeSizes[shapeId];
    }

    if (!pixelToFeetRatio) {
      // Default sizes when no ratio is set
      switch (shapeId) {
        case 1: // Recessed
        case 2: // Step
        case 3: // Presence sensor
          return 50; // Default radius
        case 4: // Spot - increased default size
          return 50; // Increased default size
        case 5: // Pendant (Linear)
        case 6: // Tape
          return 200; // Default length
        case 7: // Light - smaller default
          return 40; // Smaller default size
        case 8: // Light - smaller default
          return 50; // Default size
        default:
          return 50;
      }
    }

    // Calculate size based on pixel-to-feet ratio
    // 12 inches = 1 foot
    const defaultSizeInFeet = 1; // 1 foot default
    const defaultSizeInPixels = defaultSizeInFeet * pixelToFeetRatio;

    switch (shapeId) {
      case 1:
        return (4 / 12) * pixelToFeetRatio;
      case 2:
        return (4 / 12) * pixelToFeetRatio;
      case 3:
        return (6 / 12) * pixelToFeetRatio;
      case 4:
        return (4 / 12) * pixelToFeetRatio;
      case 5:
        return (24 / 12) * pixelToFeetRatio;
      case 6: // Tape - 2 foot length
        return (12 / 12) * pixelToFeetRatio;
      case 7: // Light - 5 inch diameter
        return (24 / 12) * pixelToFeetRatio;
      case 8: // Light - 5 inch diameter
        return (4 / 12) * pixelToFeetRatio;
      default:
        return defaultSizeInPixels;
    }
  };

  // Function to get size label based on shapeId
  const getSizeLabel = (shapeId: number): string => {
    if ([1, 2, 3, 4, 8].includes(shapeId)) {
      return 'Diameter';
    } else if ([5, 6].includes(shapeId)) {
      return 'Length';
    }
    return 'Size';
  };

  // Function to get shape function based on light_id
  const getShapeFunctionById = (lightId: string, left: number, top: number, reason?: string) => {
    const id = parseInt(lightId);
    const defaultSize = getDefaultSize(id);
    //get name from shapetype by id
    const name = getNameById(id);

    switch (id) {
      case 1:
        return () => addGlowingCircle(name, id, { left, top, radius: defaultSize / 2 }, reason);
      case 2:
        return () =>
          addCircleWithArrowOut(name, id, { left, top, radius: defaultSize / 2 }, reason);
      case 3:
        return () => presenceSensor(name, id, { left, top, radius: defaultSize / 2 }, reason);
      case 4:
        return () => addArrowShape(name, id, { left, top, radius: defaultSize / 2 }, reason);
      case 5:
        return () => addGlowingRectangle(name, id, { left, top, width: defaultSize }, reason);
      case 6:
        return () => addParallelLines(name, id, { left, top, width: defaultSize }, reason);
      case 7:
        return () => addLetterDShape(name, id, { left, top, width: defaultSize }, reason);
      case 8:
        return () => addCircleX(name, id, { left, top, radius: defaultSize / 2 }, reason);
      default:
        return () => addGlowingCircle(name, 1, { left, top, radius: defaultSize / 2 }, reason);
    }
  };

  // Function to scale coordinates from cropped image to canvas
  const scaleCoordinatesToCanvas = (
    croppedX: number,
    croppedY: number,
    croppedWidth: number,
    croppedHeight: number,
    polygonBounds: { left: number; top: number; width: number; height: number }
  ) => {
    const scaleX = polygonBounds.width / croppedWidth;
    const scaleY = polygonBounds.height / croppedHeight;
    const canvasX = polygonBounds.left + croppedX * scaleX;
    const canvasY = polygonBounds.top + croppedY * scaleY;
    return { x: canvasX, y: canvasY };
  };

  const getPolygonCropBase64 = (polygon: fabric.Polygon): Promise<string | null> => {
    return new Promise(resolve => {
      if (!canvas) {
        toast.error('Canvas not available');
        return resolve(null);
      }

      const bounds = polygon.getBoundingRect();
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) {
        toast.error('Could not create temporary canvas');
        return resolve(null);
      }

      tempCanvas.width = bounds.width;
      tempCanvas.height = bounds.height;

      const fullCanvasDataURL = canvas.toDataURL({
        format: 'png',
        quality: 1.0,
        multiplier: 1,
      });

      const fullImage = new Image();
      fullImage.onload = () => {
        try {
          tempCtx.drawImage(
            fullImage,
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height,
            0,
            0,
            bounds.width,
            bounds.height
          );

          const croppedDataURL = tempCanvas.toDataURL('image/png');
          const base64 = croppedDataURL.split(',')[1];
          resolve(base64);
        } catch (error) {
          console.error('Cropping error:', error);
          toast.error('Failed to crop image');
          resolve(null);
        }
      };

      fullImage.onerror = () => {
        toast.error('Failed to load canvas image');
        resolve(null);
      };

      fullImage.src = fullCanvasDataURL;
    });
  };

  const sendObjectToBackButAboveImage = (obj: fabric.Object, canvas: fabric.Canvas) => {
    canvas.sendObjectToBack(obj);
    const imageObject = canvas?.getObjects().find(o => o.type === 'image');
    if (imageObject) {
      canvas.bringObjectForward(obj);
    }
    canvas.renderAll();
  };

  const sendObjectBackwardsButAboveImage = (obj: fabric.Object, canvas: fabric.Canvas) => {
    canvas.sendObjectBackwards(obj);
    const objIndex = canvas.getObjects().indexOf(obj);
    const imageObject = canvas?.getObjects().find(o => o.type === 'image');
    if (imageObject && objIndex === 0) {
      canvas.bringObjectForward(obj);
    }
    canvas.renderAll();
  };

  const handleGenerateLights = async () => {
    if (!canvas || !selectedObject) return;

    const obj = canvas.getObjects().find(o => o.get('id') === selectedObject.id);
    if (!obj) return;

    if (obj.type === 'polygon') {
      const polygon = obj as fabric.Polygon;
      const base64Image = await getPolygonCropBase64(polygon);
      if (!base64Image) return;

      try {
        const response = await getLightingSuggestion(base64Image);
        const lightingData = extractJsonFromResponse(response);
        console.log('Lighting Suggestion JSON:', lightingData);

        const polygonBounds = polygon.getBoundingRect();

        if (Array.isArray(lightingData)) {
          lightingData.forEach((light: LightingData) => {
            if (light.light_id && typeof light.x === 'number' && typeof light.y === 'number') {
              const canvasCoords = scaleCoordinatesToCanvas(
                light.x,
                light.y,
                polygonBounds.width,
                polygonBounds.height,
                polygonBounds
              );

              const shapeFunction = getShapeFunctionById(
                light.light_id,
                canvasCoords.x,
                canvasCoords.y,
                light.reason
              );

              const lightObject = shapeFunction();

              if (lightObject) {
                if (light.name) {
                  lightObject.set('name', light.name);
                }
                canvas.requestRenderAll();
              }
            }
          });

          toast.success(`Generated ${lightingData.length} lights`);
        } else {
          toast.error('Invalid lighting data format');
        }
      } catch (error) {
        console.error('Error generating lights:', error);
        toast.error('Failed to generate lighting');
      }
    }
  };

  const openColorPicker = (objectId: string, type: 'fill' | 'stroke', initialColor: string) => {
    const obj = canvas?.getObjects().find(o => o.get('id') === objectId);
    const isOverlay = Boolean(
      obj && obj.type === 'group' && hasVisibleOverlayItems(obj) && type === 'fill'
    );
    setColorPickerState({
      isOpen: true,
      type,
      objectId,
      initialColor,
      isOverlay,
    });
  };

  const closeColorPicker = () => {
    setColorPickerState({
      isOpen: false,
      type: 'fill',
      objectId: null,
      initialColor: '#000000',
      isOverlay: false,
    });
  };

  // In handleColorChange, handle boundary line (id 11) for stroke color
  const handleColorChange = (color: string) => {
    if (!colorPickerState.objectId) return;
    if (colorPickerState.type === 'fill') {
      const obj = canvas?.getObjects().find(o => o.get('id') === colorPickerState.objectId);
      if (obj && obj.type === 'group' && hasVisibleOverlayItems(obj)) {
        updateOverlayColor(colorPickerState.objectId, color);
      } else {
        updateObjectColor(colorPickerState.objectId, color);
      }
    } else {
      // Add support for boundary line (id 11)
      const obj = canvas?.getObjects().find(o => o.get('id') === colorPickerState.objectId);
      if (
        (obj && (Number(obj.get('shapeId')) === 11 || obj.type === 'line')) ||
        Number(selectedObject.shapeId) === 11
      ) {
        updateObjectStrokeColor(colorPickerState.objectId, color);
      } else {
        updateObjectStrokeColor(colorPickerState.objectId, color);
      }
    }
  };

  const openStrokeOptions = (objectId: string) => {
    setStrokeOptionsState({
      isOpen: true,
      objectId,
    });
  };

  const closeStrokeOptions = () => {
    setStrokeOptionsState({
      isOpen: false,
      objectId: null,
    });
  };

  const toggleReason = () => {
    setShowReason(!showReason);
  };

  const getColorDisplayValue = (color: string) => {
    if (color.startsWith('rgba')) {
      return color;
    }
    if (color.startsWith('rgb')) {
      return color.replace('rgb', 'rgba').replace(')', ', 1)');
    }
    return color;
  };

  // Don't render if no object is selected or multiple objects are selected
  if (!selectedObject || isMultipleSelection) {
    return null;
  }

  // Function to convert inches to pixels
  const convertInchesToPixels = (inches: number): number => {
    if (!pixelToFeetRatio) return 0;
    return Math.round((inches / 12) * pixelToFeetRatio);
  };

  // Function to convert pixels to inches
  const convertPixelsToInches = (pixels: number): number => {
    if (!pixelToFeetRatio) return 0;
    return Math.round((pixels / pixelToFeetRatio) * 12);
  };

  return (
    <>
      {/* Bottom Bar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3">
        <div className="flex items-center gap-4 ">
          {/* Layer Controls - for every object */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800 relative group gap-[0px]"
              onClick={() => {
                if (canvas && selectedObject) {
                  const obj = canvas.getObjects().find(o => o.get('id') === selectedObject.id);
                  if (obj) {
                    canvas.bringObjectForward(obj);
                    canvas.requestRenderAll();
                  }
                }
              }}
              title="Bring Forward"
            >
              <MoveUp className="w-4 h-4" />
              <Layers2 className="w-4 h-4" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Bring Forward
              </div>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800 relative group gap-[0px]"
              onClick={() => {
                if (canvas && selectedObject) {
                  const obj = canvas.getObjects().find(o => o.get('id') === selectedObject.id);
                  if (obj) {
                    sendObjectBackwardsButAboveImage(obj, canvas);
                  }
                }
              }}
              title="Send Backwards"
            >
              <MoveDown className="w-4 h-4" />
              <Layers2 className="w-4 h-4" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Send Backwards
              </div>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800 relative group gap-[0px]"
              onClick={() => {
                if (canvas && selectedObject) {
                  const obj = canvas.getObjects().find(o => o.get('id') === selectedObject.id);
                  if (obj) {
                    canvas.bringObjectToFront(obj);
                    canvas.requestRenderAll();
                  }
                }
              }}
              title="Bring to Front"
            >
              <MoveUp className="w-4 h-4" />
              <Layers3 className="w-4 h-4" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Bring to Front
              </div>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800 relative group gap-[0px]"
              onClick={() => {
                if (canvas && selectedObject) {
                  const obj = canvas.getObjects().find(o => o.get('id') === selectedObject.id);
                  if (obj) {
                    sendObjectToBackButAboveImage(obj, canvas);
                  }
                }
              }}
              title="Send to Back"
            >
              <MoveDown className="w-4 h-4" />
              <Layers3 className="w-4 h-4" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Send to Back
              </div>
            </Button>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-300"></div>

          {/* Fill Color - for polygon and text */}
          {(selectedObject.type === 'polygon' ||
            selectedObject.type === 'text' ||
            selectedObject.type === 'i-text' ||
            selectedObject.type === 'textbox') && (
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-gray-600">Fill</Label>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-1 border border-gray-300 rounded-full relative"
                onClick={() => openColorPicker(selectedObject.id, 'fill', selectedObject.color)}
                style={{ backgroundColor: selectedObject.color }}
              >
                <CircleDot className="w-4 h-4 text-white" />
              </Button>
            </div>
          )}

          {/* Color for boundary line or line */}
          {(selectedObject.type === 'line' || Number(selectedObject.shapeId) === 11) && (
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-gray-600">Color</Label>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-1 border border-gray-300 rounded-full relative"
                onClick={() =>
                  openColorPicker(
                    selectedObject.id,
                    'stroke',
                    selectedObject.strokeColor || '#000000'
                  )
                }
                style={{ backgroundColor: selectedObject.strokeColor || '#000000' }}
              >
                <CircleDot className="w-4 h-4 text-white" />
              </Button>
            </div>
          )}

          {/* Stroke Options - for polygon */}
          {selectedObject.type === 'polygon' && (
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-gray-600">Stroke</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => openStrokeOptions(selectedObject.id)}
              >
                <Palette className="w-4 h-4 mr-1" />
                {selectedObject.strokeWidth || 1}px
              </Button>
            </div>
          )}

          {/* Text Size - for text objects */}
          {(selectedObject.type === 'text' ||
            selectedObject.type === 'i-text' ||
            selectedObject.type === 'textbox') && (
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-gray-600">Size</Label>
              <Input
                type="number"
                value={selectedObject.fontSize || 16}
                onChange={e => updateFontSize(selectedObject.id, Number(e.target.value))}
                className="w-20 h-8 text-sm"
                min="8"
                max="72"
              />
            </div>
          )}

          {/* Group Size - for resizable groups */}
          {selectedObject.type === 'group' && isResizableGroup(selectedObject.id) && (
            <>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-gray-600">
                  {getSizeLabel(
                    canvas
                      ?.getObjects()
                      ?.find(o => o.get('id') === selectedObject.id)
                      ?.get('shapeId') || 0
                  )}
                </Label>
                <Input
                  type="number"
                  value={
                    isEditingSize
                      ? currentGroupSize
                      : currentGroupSize ||
                        convertPixelsToInches(getGroupSize(selectedObject.id)).toString()
                  }
                  onChange={e => {
                    const value = e.target.value;
                    setIsEditingSize(true);
                    setCurrentGroupSize(value);
                    if (value !== '') {
                      const newSize = Number(value);
                      if (!isNaN(newSize)) {
                        updateGroupSize(selectedObject.id, convertInchesToPixels(newSize));
                      }
                    }
                  }}
                  onBlur={() => {
                    setIsEditingSize(false);
                    if (currentGroupSize === '') {
                      setCurrentGroupSize(
                        convertPixelsToInches(getGroupSize(selectedObject.id)).toString()
                      );
                    }
                  }}
                  className="w-20 h-8 text-sm"
                  step="1"
                />
              </div>
              <div className="w-px h-6 bg-gray-300"></div>
            </>
          )}

          {/* Overlay Controls - for groups with visible overlay items */}
          {selectedObject.type === 'group' &&
            canvas?.getObjects()?.find(o => o.get('id') === selectedObject.id) &&
            hasVisibleOverlayItems(
              canvas.getObjects().find(o => o.get('id') === selectedObject.id)!
            ) && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-600">Overlay</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-1 border border-gray-300 rounded-full relative"
                    onClick={() => openColorPicker(selectedObject.id, 'fill', selectedObject.color)}
                    style={{ backgroundColor: selectedObject.color }}
                  >
                    <CircleDot className="w-4 h-4 text-white" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-gray-600">Opacity</Label>
                  <Input
                    type="number"
                    value={Math.round((selectedObject.opacity || 1) * 100)}
                    onChange={e =>
                      updateOverlayOpacity(selectedObject.id, Number(e.target.value) / 100)
                    }
                    className="w-16 h-8 text-sm"
                    min="0"
                    max="100"
                    step="5"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </>
            )}

          {/* Generate Lights Button - only for polygon */}
          {selectedObject.type === 'polygon' && (
            <>
              <div className="w-px h-6 bg-gray-300"></div>
              <Button
                variant="default"
                size="sm"
                className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all duration-200 ${
                  isLoadingLighting
                    ? 'bg-blue-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                onClick={handleGenerateLights}
                disabled={isLoadingLighting}
              >
                {isLoadingLighting ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-white font-medium">Generating...</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Lights
                  </>
                )}
              </Button>
            </>
          )}

          {/* Reason Button - only for objects with reason */}
          {hasReason() && (
            <>
              <div className="w-px h-6 bg-gray-300"></div>
              <Button
                variant="outline"
                size="sm"
                className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all duration-200 ${
                  showReason
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-800'
                    : 'border-yellow-400 text-yellow-700 hover:bg-yellow-50'
                }`}
                onClick={toggleReason}
              >
                <Lightbulb className="w-4 h-4" />
                Reason
              </Button>
            </>
          )}
        </div>

        {/* Reason Display Section */}
        {showReason && hasReason() && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex-shrink-0 mt-0.5">
                <Lightbulb className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-yellow-800 truncate">
                    {selectedObject?.name || 'Shape'}
                  </h4>
                  <p className="text-xs text-yellow-700 leading-relaxed">
                    {getSelectedObjectReason()}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReason(false)}
                    className="h-5 w-5 p-0 hover:bg-yellow-100 flex items-center justify-center text-yellow-600 hover:text-yellow-800 "
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Color Picker Modal */}
      {colorPickerState.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="relative z-10">
            <CustomColorPicker
              initialColor={colorPickerState.initialColor}
              onColorChange={handleColorChange}
              onClose={closeColorPicker}
              isOverlay={colorPickerState.isOverlay}
            />
          </div>
        </div>
      )}

      {/* Stroke Options Modal */}
      {strokeOptionsState.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-80 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Stroke Options</h3>
              <button onClick={closeStrokeOptions} className="text-gray-500 hover:text-gray-700">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-600 mb-2 block">Stroke Color</Label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-12 h-8 p-1 border border-gray-300"
                    onClick={() => {
                      closeStrokeOptions();
                      openColorPicker(
                        strokeOptionsState.objectId!,
                        'stroke',
                        selectedObject?.strokeColor || '#000000'
                      );
                    }}
                    style={{ backgroundColor: selectedObject?.strokeColor || '#000000' }}
                  />
                  <Input
                    type="text"
                    value={getColorDisplayValue(selectedObject?.strokeColor || '#000000')}
                    onChange={e =>
                      updateObjectStrokeColor(strokeOptionsState.objectId!, e.target.value)
                    }
                    className="flex-1 text-sm"
                    placeholder="#000000 or rgba(r,g,b,a)"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-600 mb-2 block">Stroke Width</Label>
                <Input
                  type="number"
                  value={selectedObject?.strokeWidth || 1}
                  onChange={e =>
                    updateObjectStrokeWidth(strokeOptionsState.objectId!, Number(e.target.value))
                  }
                  className="w-full text-sm"
                  min="0"
                  max="20"
                  step="0.5"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                variant="default"
                size="sm"
                onClick={closeStrokeOptions}
                className="px-4 py-2"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ObjectControlBar;
