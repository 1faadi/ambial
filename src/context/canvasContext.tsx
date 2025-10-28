'use client';
import React, { createContext, useContext, useRef, useState, ReactNode, JSX } from 'react';
import * as fabric from 'fabric';
import { CanvasContextValue } from '@/types/fabric';
import { ExtendedCanvas } from '@/types/fabric';
import { toggleLineEditMode } from '@/utils/fabric/fabricShapes';

const CanvasContext = createContext<CanvasContextValue | undefined>(undefined);

const defaultControlsVisibility = {
  mt: false,
  mb: false,
  ml: false,
  mr: false,
  tl: false,
  tr: false,
  bl: false,
  br: false,
  mtr: true,
};
const PROXIMITY_THRESHOLD = 10;

export const CanvasProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const shouldRecordHistory = useRef<boolean>(true);
  const initialCanvas = useRef<string>('');
  const isEditingPolygon = useRef<boolean>(false);
  const selectedPolygon = useRef<fabric.Polygon>(null);

  // Store reference to the delete key handler for cleanup
  const deleteKeyHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  // Add refs for Space cursor handling
  const spaceKeyHandlerRef = useRef<{
    keydown: (e: KeyboardEvent) => void;
    keyup: (e: KeyboardEvent) => void;
    blur: () => void;
  } | null>(null);
  const isSpacePressed = useRef<boolean>(false);
  const originalCursor = useRef<string>('default');

  // Add refs for touchpad panning
  const touchpadHandlerRef = useRef<{
    wheel: (e: WheelEvent) => void;
  } | null>(null);
  const isPanning = useRef<boolean>(false);
  const panTimeout = useRef<NodeJS.Timeout | null>(null);

  // Add ref to track zone ID for incrementing
  const currentZoneId = useRef<number>(1);

  const setInitialCanvas = (json: string) => {
    initialCanvas.current = json;
  };

  const getInitialCanvas = (): string => {
    return initialCanvas.current;
  };

  const setShouldRecordHistory = (recordHistory: boolean) => {
    shouldRecordHistory.current = recordHistory;
  };

  const getShouldRecordHistory = (): boolean => {
    return shouldRecordHistory.current;
  };

  // Helper function to check if user is currently in a text input
  const isUserTyping = (): boolean => {
    const activeElement = document.activeElement as HTMLElement;

    // Check for various input types
    const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT'];
    const isInputElement = inputTypes.includes(activeElement?.tagName);
    const isContentEditable = activeElement?.isContentEditable;
    const isInDialog = activeElement?.closest('[role="dialog"]') !== null;

    return isInputElement || isContentEditable || isInDialog;
  };

  // Helper function to detect touchpad vs mouse wheel
  const isTouchpadGesture = (e: WheelEvent): boolean => {
    // Multiple heuristics to detect touchpad:

    // 1. Check for high-precision scrolling (touchpad typically has fractional deltaY)
    const hasFractionalDelta = e.deltaY % 1 !== 0;

    // 2. Check deltaMode - touchpad usually uses DOM_DELTA_PIXEL (0)
    const isPixelMode = e.deltaMode === WheelEvent.DOM_DELTA_PIXEL;

    // 3. Check for moderate delta values (touchpad gestures are usually smaller)
    const hasModerateScroll = Math.abs(e.deltaY) < 50 && Math.abs(e.deltaX) < 50;

    // 4. Check if both X and Y deltas exist (common with touchpad two-finger gestures)
    const hasBothAxes = Math.abs(e.deltaX) > 0 && Math.abs(e.deltaY) > 0;

    // 5. Check if ctrlKey is pressed (pinch-to-zoom gesture)
    const isPinchGesture = e.ctrlKey;

    // Return true if it's likely a touchpad pan gesture (not zoom)
    return (
      isPixelMode && (hasFractionalDelta || hasModerateScroll || hasBothAxes) && !isPinchGesture
    );
  };

  // Helper function to check if the wheel event is over the canvas
  const isOverCanvas = (fabricCanvas: fabric.Canvas, e: WheelEvent): boolean => {
    const canvasElement = fabricCanvas.getElement();
    if (!canvasElement) return false;

    const rect = canvasElement.getBoundingClientRect();
    return (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
  };

  const deleteSelectedObjects = (fabricCanvas: fabric.Canvas) => {
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length > 0) {
      // Remove each selected object
      activeObjects.forEach(obj => {
        fabricCanvas.remove(obj);
      });
      // Clear the selection
      fabricCanvas.discardActiveObject();
      // Re-render the canvas
      fabricCanvas.renderAll();
    }
  };

  const createDeleteKeyHandler = (fabricCanvas: fabric.Canvas) => {
    return function (e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Allow normal behavior in inputs or when dialog is open
        if (isUserTyping()) {
          return; // Don't prevent default, let the input handle it
        }

        // Only handle canvas deletion if not in an input
        deleteSelectedObjects(fabricCanvas);
        e.preventDefault();
      }
    };
  };

  const setupDeleteKeyHandler = (fabricCanvas: fabric.Canvas) => {
    // Remove existing handler if it exists
    if (deleteKeyHandlerRef.current) {
      document.removeEventListener('keydown', deleteKeyHandlerRef.current);
    }

    // Create and store new handler
    const handler = createDeleteKeyHandler(fabricCanvas);
    deleteKeyHandlerRef.current = handler;

    // Add the event listener
    document.addEventListener('keydown', handler);
  };

  // Touchpad panning handler
  const setupTouchpadPanHandler = (fabricCanvas: fabric.Canvas) => {
    // Remove existing handler if it exists
    if (touchpadHandlerRef.current) {
      document.removeEventListener('wheel', touchpadHandlerRef.current.wheel, {
        passive: false,
      } as EventListenerOptions);
    }

    const handleWheel = (e: WheelEvent) => {
      // Only handle if it's over the canvas and appears to be a touchpad gesture
      if (!isOverCanvas(fabricCanvas, e) || !isTouchpadGesture(e)) {
        return;
      }

      // Don't interfere with pinch-to-zoom or if user is typing
      if (e.ctrlKey || isUserTyping()) {
        return;
      }

      // Prevent default scrolling behavior
      e.preventDefault();

      // Set panning state
      if (!isPanning.current) {
        isPanning.current = true;
        // Update cursor to indicate panning
        fabricCanvas.defaultCursor = 'grabbing';
        fabricCanvas.setCursor('grabbing');
        if (fabricCanvas.getElement()) {
          fabricCanvas.getElement().style.cursor = 'grabbing';
        }
      }

      // Clear existing timeout and set new one
      if (panTimeout.current) {
        clearTimeout(panTimeout.current);
      }

      // Apply the pan transformation
      const vpt = fabricCanvas.viewportTransform!;

      // Invert the delta values to make panning feel natural
      // (moving fingers right should pan the canvas right)
      vpt[4] -= e.deltaX;
      vpt[5] -= e.deltaY;

      fabricCanvas.setViewportTransform(vpt);
      fabricCanvas.requestRenderAll();

      // Set timeout to end panning state
      panTimeout.current = setTimeout(() => {
        isPanning.current = false;

        // Reset cursor only if space is not pressed
        const newCursor = isSpacePressed.current ? 'grab' : originalCursor.current;
        fabricCanvas.defaultCursor = newCursor;
        fabricCanvas.setCursor(newCursor);
        if (fabricCanvas.getElement()) {
          fabricCanvas.getElement().style.cursor = newCursor;
        }

        panTimeout.current = null;
      }, 150); // 150ms delay to detect end of gesture
    };

    // Store handler for cleanup
    touchpadHandlerRef.current = {
      wheel: handleWheel,
    };

    // Add event listener with passive: false to allow preventDefault
    document.addEventListener('wheel', handleWheel, { passive: false });
  };

  // Space cursor handling functions
  const setupSpaceCursorHandler = (fabricCanvas: fabric.Canvas) => {
    // Remove existing handlers if they exist
    if (spaceKeyHandlerRef.current) {
      document.removeEventListener('keydown', spaceKeyHandlerRef.current.keydown);
      document.removeEventListener('keyup', spaceKeyHandlerRef.current.keyup);
      window.removeEventListener('blur', spaceKeyHandlerRef.current.blur);
    }

    // Store original cursor
    originalCursor.current = fabricCanvas.defaultCursor || 'default';

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in a text field - if so, don't handle space for panning
      if (e.code === 'Space' && isUserTyping()) {
        return; // Allow normal space behavior in text fields
      }

      // Prevent space from scrolling the page and handle canvas panning
      if (e.code === 'Space' && !isSpacePressed.current) {
        e.preventDefault();
        isSpacePressed.current = true;
        fabricCanvas.defaultCursor = 'grab';

        // Force immediate cursor update
        fabricCanvas.setCursor('grab');

        // Also set the canvas element cursor directly
        if (fabricCanvas.getElement()) {
          fabricCanvas.getElement().style.cursor = 'grab';
        }

        fabricCanvas.renderAll();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isSpacePressed.current) {
        isSpacePressed.current = false;

        // Don't reset cursor if currently panning with touchpad
        if (!isPanning.current) {
          fabricCanvas.defaultCursor = originalCursor.current;

          // Force immediate cursor update
          fabricCanvas.setCursor(originalCursor.current);

          // Also set the canvas element cursor directly
          if (fabricCanvas.getElement()) {
            fabricCanvas.getElement().style.cursor = originalCursor.current;
          }

          fabricCanvas.renderAll();
        }
      }
    };

    const handleBlur = () => {
      if (isSpacePressed.current) {
        isSpacePressed.current = false;

        // Don't reset cursor if currently panning with touchpad
        if (!isPanning.current) {
          fabricCanvas.defaultCursor = originalCursor.current;

          // Force immediate cursor update
          fabricCanvas.setCursor(originalCursor.current);

          // Also set the canvas element cursor directly
          if (fabricCanvas.getElement()) {
            fabricCanvas.getElement().style.cursor = originalCursor.current;
          }

          fabricCanvas.renderAll();
        }
      }
    };

    // Store handlers for cleanup
    spaceKeyHandlerRef.current = {
      keydown: handleKeyDown,
      keyup: handleKeyUp,
      blur: handleBlur,
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
  };

  const initializeCanvas = (
    canvasElement: HTMLCanvasElement,
    options?: Partial<fabric.CanvasOptions>
  ): fabric.Canvas => {
    if (canvas) {
      canvas.dispose();
    }

    const defaultOptions: Partial<fabric.CanvasOptions> = {
      width: 800,
      height: 600,
      backgroundColor: 'white',
      preserveObjectStacking: true,
      ...options,
    };

    fabric.FabricObject.customProperties = [
      'shapeCategory',
      'id',
      'shapeType',
      'name',
      'shapeId',
      'reason',
      'layerId',
      'layerName',
      'polygonId',
      'zone1Id',
      'zone2Id',
      'boundaryPosition',
      'roomName',
      'exportId',
      'componentId',
      'componentNumber',
      'zoneId',
      'layerExportId',
      'layers',
      'zoneUuid',
      'layerUuid',
      'presenceSensorId',
      'manufacturer',
      'lumens',
      'nightLight',
      'modelName',
      'modelId',
      'sizeIn',
      'unitPrice',
      'mix',
      'sightLine',
      'brightnessScale',
      'channelCount',
      'wattPower',
    ];
    fabric.FabricObject.ownDefaults.borderScaleFactor = 3;
    fabric.FabricObject.ownDefaults.borderColor = '#318ae9';
    fabric.FabricObject.ownDefaults.cornerColor = '#318ae9';
    const fabricCanvas = new fabric.Canvas(canvasElement, defaultOptions) as ExtendedCanvas;
    setCanvas(fabricCanvas);
    setIsReady(true);
    canvasRef.current = fabricCanvas;
    fabricCanvas.renderAll();
    setupDeleteKeyHandler(fabricCanvas);

    // Setup Space cursor handler
    setupSpaceCursorHandler(fabricCanvas);

    // Setup touchpad panning handler
    setupTouchpadPanHandler(fabricCanvas);

    // Set default controls on object add
    fabricCanvas.on('object:added', function (e) {
      const addedObject = e.target;
      if (!addedObject.get('id')) {
        addedObject.set('id', crypto.randomUUID());
        // addedObject.set('manufacturer', 'Custom');
        // addedObject.set('lumens', 800);
        // addedObject.set('nightLight', 0);
        // addedObject.set('modelName', 'Custom Model');
        // addedObject.set('modelId', 'custom-model');
        if (addedObject instanceof fabric.Polygon) {
          // Assign sequential numeric zone id (only if not already set)
          if (!addedObject.get('zoneId')) {
            addedObject.set('zoneId', currentZoneId.current);
          }

          // Only set the display name if it is missing or generic. Do not override a name
          // already provided by the sidebar (which passes "Zone N").
          const existingName = (addedObject.get('name') as string) || '';
          const isGeneric = existingName.trim().length === 0 || /^zone\s*$/i.test(existingName);
          if (isGeneric) {
            // Compute next index based on current polygons on canvas
            const polygonCount = canvas?.getObjects().filter(o => o.type === 'polygon').length;
            const zoneDisplayName = `Zone ${polygonCount}`; // includes this newly added polygon
            addedObject.set('name', zoneDisplayName);
            addedObject.set('shapeType', zoneDisplayName);
            addedObject.set('roomName', zoneDisplayName);
          }
          const defaultLayer = {
            id: crypto.randomUUID(),
            layerId: 1,
            name: 'Layer 1',
          };
          addedObject.set('layers', [defaultLayer]);
          currentZoneId.current++;
        }
      }
      e.target.setControlsVisibility(defaultControlsVisibility);
    });

    // Object click and coordinate logging
    fabricCanvas.on('mouse:down', options => {
      const evt = options.e as MouseEvent;
      if (isSpacePressed.current) {
        // Change cursor to 'grabbing' when actually dragging
        fabricCanvas.defaultCursor = 'grabbing';
        fabricCanvas.setCursor('grabbing');
        if (fabricCanvas.getElement()) {
          fabricCanvas.getElement().style.cursor = 'grabbing';
        }
        fabricCanvas.isDragging = true;
        fabricCanvas.selection = false;
        fabricCanvas.lastPosX = evt.clientX;
        fabricCanvas.lastPosY = evt.clientY;
        return;
      }
    });

    fabricCanvas.on('mouse:move', opt => {
      if (fabricCanvas.isDragging) {
        const evt = opt.e as MouseEvent;
        const vpt = fabricCanvas.viewportTransform!;
        vpt[4] += evt.clientX - fabricCanvas.lastPosX!;
        vpt[5] += evt.clientY - fabricCanvas.lastPosY!;
        fabricCanvas.requestRenderAll();
        fabricCanvas.lastPosX = evt.clientX;
        fabricCanvas.lastPosY = evt.clientY;
      }
    });

    fabricCanvas.on('mouse:up', () => {
      fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform);
      fabricCanvas.isDragging = false;
      fabricCanvas.selection = true;

      // Reset cursor back to 'grab' if Space is still pressed or touchpad panning, otherwise to original
      const newCursor =
        isSpacePressed.current || isPanning.current ? 'grab' : originalCursor.current;
      fabricCanvas.defaultCursor = newCursor;
      fabricCanvas.setCursor(newCursor);
      if (fabricCanvas.getElement()) {
        fabricCanvas.getElement().style.cursor = newCursor;
      }
    });

    fabricCanvas.on('mouse:dblclick', options => {
      if (options.target) {
        const clickedObject = options.target;

        // Get object type
        const objectType = clickedObject.type;
        // Polygon edit mode (existing)
        if (objectType === 'polygon') {
          const polygon = clickedObject as fabric.Polygon;
          if (selectedPolygon.current == null) {
            selectedPolygon.current = polygon;
          } else if (
            selectedPolygon.current != null &&
            polygon.get('id') == selectedPolygon.current.get('id')
          ) {
            selectedPolygon.current = null;
          } else if (
            selectedPolygon.current != null &&
            polygon.get('id') != selectedPolygon.current.get('id')
          ) {
            toggleEditMode(selectedPolygon.current, fabricCanvas!);
            selectedPolygon.current = polygon;
          }
          toggleEditMode(polygon, fabricCanvas!);
        }
        // Glowing line edit mode
        if (objectType === 'line' && clickedObject.get('shapeId') === 11) {
          toggleLineEditMode(clickedObject as fabric.Line, fabricCanvas);
        }
      }
    });

    return fabricCanvas;
  };

  const toggleEditMode = (polygon: fabric.Polygon, canvas: fabric.Canvas) => {
    if (!polygon) return;

    isEditingPolygon.current = !isEditingPolygon.current;

    if (isEditingPolygon.current) {
      polygon.cornerStyle = 'circle';
      polygon.cornerColor = 'rgba(0,0,255,0.5)';
      polygon.hasBorders = false;

      if (fabric.controlsUtils?.createPolyControls) {
        polygon.controls = fabric.controlsUtils.createPolyControls(polygon);
      } else {
        console.warn('fabric.controlsUtils.createPolyControls not available');
        polygon.controls = fabric.FabricObject.prototype.controls;
      }

      canvas.on('mouse:down', e => onEditMouseDown(e, polygon, canvas));
    } else {
      polygon.cornerStyle = 'rect';
      polygon.cornerColor = 'blue';
      polygon.hasBorders = true;

      if (fabric.controlsUtils?.createObjectDefaultControls) {
        polygon.controls = fabric.controlsUtils.createObjectDefaultControls();
      } else {
        polygon.controls = fabric.FabricObject.prototype.controls;
      }

      canvas.off('mouse:down', e => onEditMouseDown(e, polygon, canvas));
    }

    polygon.setCoords();
    canvas.requestRenderAll();
  };

  const onEditMouseDown = (e: fabric.TEvent, polygon: fabric.Polygon, canvas: fabric.Canvas) => {
    if (!isEditingPolygon.current || !polygon) return;
    const pointer = canvas.getScenePoint(e.e);

    // const absPoints = polygon.points;
    const absPoints = polygon.points.map(p =>
      fabric.util.transformPoint(
        new fabric.Point(p.x - polygon!.pathOffset.x, p.y - polygon!.pathOffset.y),
        polygon!.calcTransformMatrix()
      )
    );

    // Check if clicking near an existing point
    const clickedPointIndex = absPoints.findIndex(
      p => Math.hypot(p.x - pointer.x, p.y - pointer.y) < PROXIMITY_THRESHOLD
    );

    const clickedNearPoint = clickedPointIndex !== -1;
    // if (clickedNearPoint) return;

    if (clickedNearPoint) {
      if (e.e.ctrlKey) {
        deletePointFromPolygon(polygon, clickedPointIndex);
        canvas.requestRenderAll();
        return;
      } else {
        return;
      }
    } // Allow dragging existing points

    // Check for clicking on a line segment
    for (let i = 0; i < absPoints.length; i++) {
      const start = absPoints[i];
      const end = absPoints[(i + 1) % absPoints.length];
      const dist = distanceToSegment(pointer, start, end);

      if (dist < PROXIMITY_THRESHOLD) {
        const localPoint = fabric.util.transformPoint(
          pointer,
          fabric.util.invertTransform(polygon.calcTransformMatrix())
        );
        localPoint.x += polygon.pathOffset.x;
        localPoint.y += polygon.pathOffset.y;
        addPointToPolygon(polygon, localPoint, i + 1);
        canvas.requestRenderAll();
        break;
      }
    }
  };

  const distanceToSegment = (
    p: { x: number; y: number },
    v: { x: number; y: number },
    w: { x: number; y: number }
  ) => {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);

    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));

    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  const addPointToPolygon = (
    polygon: fabric.Polygon,
    point: { x: number; y: number },
    insertIndex: number
  ) => {
    polygon.points.splice(insertIndex, 0, point);
    polygon.set({ dirty: true });

    // Update controls for edit mode
    if (isEditingPolygon.current && fabric.controlsUtils?.createPolyControls) {
      polygon.controls = fabric.controlsUtils.createPolyControls(polygon);
    }

    polygon.setCoords();
  };

  const deletePointFromPolygon = (polygon: fabric.Polygon, pointIndex: number) => {
    // Remove the point at the specified index
    polygon.points.splice(pointIndex, 1);
    polygon.set({ dirty: true });

    // Update controls for edit mode
    if (isEditingPolygon.current && fabric.controlsUtils?.createPolyControls) {
      polygon.controls = fabric.controlsUtils.createPolyControls(polygon);
    }

    polygon.setCoords();
  };

  const disposeCanvas = () => {
    // Clear any pending timeout
    if (panTimeout.current) {
      clearTimeout(panTimeout.current);
      panTimeout.current = null;
    }

    // Remove the delete key event listener
    if (deleteKeyHandlerRef.current) {
      document.removeEventListener('keydown', deleteKeyHandlerRef.current);
      deleteKeyHandlerRef.current = null;
    }

    // Remove Space cursor event listeners
    if (spaceKeyHandlerRef.current) {
      document.removeEventListener('keydown', spaceKeyHandlerRef.current.keydown);
      document.removeEventListener('keyup', spaceKeyHandlerRef.current.keyup);
      window.removeEventListener('blur', spaceKeyHandlerRef.current.blur);
      spaceKeyHandlerRef.current = null;
    }

    // Remove touchpad event listener
    if (touchpadHandlerRef.current) {
      document.removeEventListener('wheel', touchpadHandlerRef.current.wheel);
      touchpadHandlerRef.current = null;
    }

    // Dispose the canvas
    canvas?.dispose();

    // Reset state
    setCanvas(null);
    setIsReady(false);
    canvasRef.current = null;
  };

  const value: CanvasContextValue = {
    canvas,
    isReady,
    initializeCanvas,
    setShouldRecordHistory,
    getShouldRecordHistory,
    setInitialCanvas,
    getInitialCanvas,
    disposeCanvas,
    canvasRef: canvasRef.current,
  };

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
};

export const useCanvas = (): CanvasContextValue => {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvas must be used within CanvasProvider');
  }
  return context;
};
