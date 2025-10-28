import { ShapeCreators, ShapeOptions } from '@/types/fabric';
import * as fabric from 'fabric';
import { toast } from 'sonner';
import { ComponentType } from '@/utils/enum';
import { assignCategory } from '@/lib/utils';

interface EditableLine extends fabric.Line {
  _editMode?: boolean;
  _updateCirclePositions?: () => void;
  _dblClickHandlerAttached?: boolean;
  _selectionClearedHandlerAttached?: boolean;
  _selectionCreatedHandlerAttached?: boolean;
  calcLinePoints: () => { x1: number; y1: number; x2: number; y2: number };
}

// --- Edit Mode Handlers ---
export function toggleLineEditMode(line: fabric.Line, canvas: fabric.Canvas) {
  const editableLine = line as EditableLine;
  let endpointCircles: [fabric.Circle, fabric.Circle] | null = null;
  const ENDPOINT_RADIUS = 7;
  const ENDPOINT_COLOR = 'blue';
  const ENDPOINT_STROKE = 'white';
  const ENDPOINT_STROKE_WIDTH = 2;
  let editMode = !!editableLine._editMode;

  function enterEditMode() {
    if (!editableLine) return;
    editMode = true;
    editableLine._editMode = true;
    // Get the line's actual endpoint coordinates
    const coords = editableLine.calcLinePoints();
    const center = editableLine.getCenterPoint();
    // Calculate actual endpoint positions in canvas coordinates
    const x1 = center.x + coords.x1;
    const y1 = center.y + coords.y1;
    const x2 = center.x + coords.x2;
    const y2 = center.y + coords.y2;
    // Create endpoint circles at the correct positions
    const c1 = new fabric.Circle({
      left: x1,
      top: y1,
      radius: ENDPOINT_RADIUS,
      fill: ENDPOINT_COLOR,
      stroke: ENDPOINT_STROKE,
      strokeWidth: ENDPOINT_STROKE_WIDTH,
      originX: 'center',
      originY: 'center',
      hasBorders: false,
      hasControls: false,
      selectable: true,
      evented: true,
    });
    const c2 = new fabric.Circle({
      left: x2,
      top: y2,
      radius: ENDPOINT_RADIUS,
      fill: ENDPOINT_COLOR,
      stroke: ENDPOINT_STROKE,
      strokeWidth: ENDPOINT_STROKE_WIDTH,
      originX: 'center',
      originY: 'center',
      hasBorders: false,
      hasControls: false,
      selectable: true,
      evented: true,
    });
    endpointCircles = [c1, c2];
    canvas.add(c1);
    canvas.add(c2);
    // Type guard for bringToFront
    const bringToFrontCanvas = canvas as unknown as { bringToFront?: (obj: fabric.Object) => void };
    if (typeof bringToFrontCanvas.bringToFront === 'function') {
      bringToFrontCanvas.bringToFront(c1);
      bringToFrontCanvas.bringToFront(c2);
    }
    canvas.setActiveObject(editableLine);
    canvas.renderAll();
    // Drag handlers - update line endpoints based on circle positions
    c1.on('moving', function () {
      const center = editableLine.getCenterPoint();
      const newX1 = c1.left! - center.x;
      const newY1 = c1.top! - center.y;
      const coords = editableLine.calcLinePoints();
      const newCoords = [
        center.x + newX1,
        center.y + newY1,
        center.x + coords.x2,
        center.y + coords.y2,
      ];
      editableLine.set({ x1: newCoords[0], y1: newCoords[1], x2: newCoords[2], y2: newCoords[3] });
      editableLine.setCoords();
      canvas.renderAll();
    });
    c2.on('moving', function () {
      const center = editableLine.getCenterPoint();
      const newX2 = c2.left! - center.x;
      const newY2 = c2.top! - center.y;
      const coords = editableLine.calcLinePoints();
      const newCoords = [
        center.x + coords.x1,
        center.y + coords.y1,
        center.x + newX2,
        center.y + newY2,
      ];
      editableLine.set({ x1: newCoords[0], y1: newCoords[1], x2: newCoords[2], y2: newCoords[3] });
      editableLine.setCoords();
      canvas.renderAll();
    });
    // Keep endpoint circles in sync with line when line is moved/scaled/rotated
    const updateCirclePositions = () => {
      const coords = editableLine.calcLinePoints();
      const center = editableLine.getCenterPoint();
      const x1 = center.x + coords.x1;
      const y1 = center.y + coords.y1;
      const x2 = center.x + coords.x2;
      const y2 = center.y + coords.y2;
      c1.set({ left: x1, top: y1 });
      c2.set({ left: x2, top: y2 });
      c1.setCoords();
      c2.setCoords();
      canvas.renderAll();
    };
    editableLine.on('moving', updateCirclePositions);
    editableLine.on('scaling', updateCirclePositions);
    editableLine.on('rotating', updateCirclePositions);
    editableLine._updateCirclePositions = updateCirclePositions;
    // Prevent selection of line while editing endpoints
    editableLine.selectable = false;
  }

  function exitEditMode() {
    if (!editableLine || !endpointCircles) return;
    editMode = false;
    editableLine._editMode = false;
    endpointCircles.forEach(c => canvas.remove(c));
    endpointCircles = null;
    // Remove listeners for keeping circles in sync
    if (editableLine._updateCirclePositions) {
      editableLine.off('moving', editableLine._updateCirclePositions);
      editableLine.off('scaling', editableLine._updateCirclePositions);
      editableLine.off('rotating', editableLine._updateCirclePositions);
      delete editableLine._updateCirclePositions;
    }
    editableLine.selectable = true;
    canvas.discardActiveObject();
    canvas.renderAll();
  }

  // Attach double-click handler for edit mode
  if (!editableLine._dblClickHandlerAttached) {
    editableLine.on('mousedblclick', () => {
      if (!editMode) {
        enterEditMode();
      }
    });
    editableLine._dblClickHandlerAttached = true;
  }

  // Attach selection:cleared to exit edit mode
  if (!editableLine._selectionClearedHandlerAttached) {
    canvas.on('selection:cleared', () => {
      if (editMode) {
        exitEditMode();
      }
    });
    editableLine._selectionClearedHandlerAttached = true;
  }

  // Attach selection:created to exit edit mode if another object is selected
  if (!editableLine._selectionCreatedHandlerAttached) {
    canvas.on('selection:created', e => {
      if (editMode && (!e.selected || e.selected[0] !== editableLine)) {
        exitEditMode();
      }
    });
    editableLine._selectionCreatedHandlerAttached = true;
  }

  // Always ensure selectable is true when not editing
  if (!editMode) {
    editableLine.selectable = true;
  }
}

export const createShapes = (
  canvas: fabric.Canvas,
  center: { x: number; y: number }
): ShapeCreators => {
  const getProportionalStrokeWidth = (baseSize: number): number => {
    // Calculate stroke width based on the base size of the shape
    // Larger shapes get proportionally thicker strokes
    const minStroke = 0;
    const maxStroke = 8;
    const strokeRatio = 0.05; // 2% of base size
    const strokeWidth = Math.max(minStroke, Math.min(maxStroke, baseSize * strokeRatio));
    return strokeWidth;
  };

  return {
    addGlowingCircle: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const radius = options.radius || 50;
      const strokeWidth = getProportionalStrokeWidth(radius * 2); // Use diameter as base size

      // Inner black circle
      const innerCircle = new fabric.Circle({
        left: 0,
        top: 0,
        fill: '',
        stroke: '#000000',
        strokeWidth: strokeWidth,
        originX: 'center',
        originY: 'center',
        radius: radius,
      });

      // Outer golden circle (10x diameter = 5x radius)
      const glowR = radius * 10; // same as outerCircle.radius

      const outerCircle = new fabric.Circle({
        left: 0,
        top: 0,
        radius: glowR,
        strokeWidth: 0,
        originX: 'center',
        originY: 'center',
      });

      outerCircle.set(
        'fill',
        new fabric.Gradient({
          type: 'radial',
          gradientUnits: 'pixels', // << important
          coords: {
            x1: glowR,
            y1: glowR,
            r1: radius, // inner center & radius (near black ring)
            x2: glowR,
            y2: glowR,
            r2: glowR, // outer center & radius (edge of glow)
          },
          colorStops: [
            { offset: 0, color: '#FFDE21', opacity: 0.6 }, // strong near black circle
            { offset: 0.5, color: '#FFDE21', opacity: 0.3 }, // softer mid-glow
            { offset: 0.85, color: '#FFDE21', opacity: 0.1 }, // softer mid-glow
            { offset: 1, color: '#FFDE21', opacity: 0.0 },
          ],
        })
      );
      assignCategory(outerCircle, ComponentType.Overlay);

      // Group both circles together
      const circleGroup = new fabric.Group([outerCircle, innerCircle], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });

      circleGroup.strokeUniform = true;

      canvas.add(circleGroup);
      circleGroup?.set('name', name);
      circleGroup?.set('shapeType', name);
      circleGroup?.set('shapeId', shapeId);
      if (reason) {
        circleGroup?.set('reason', reason);
      }
      assignCategory(circleGroup, ComponentType.Light);
      circleGroup.setControlsVisibility({
        mtr: false,
      });
      canvas.setActiveObject(circleGroup);
      canvas.renderAll();
      return circleGroup;
    },

    addCircleWithArrowOut: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const radius = options.radius || 50;
      const strokeWidth = getProportionalStrokeWidth(radius * 2); // Use diameter as base size
      const arrowLength = radius * 1.4;
      const arrowHeadSize = Math.max(2, radius * 0.32);

      const triW = radius * 8;
      const triH = radius * 4;

      const lightTriangle = new fabric.Triangle({
        width: triW,
        height: triH,
        angle: 270,
        fill: new fabric.Gradient({
          type: 'linear',
          gradientUnits: 'pixels',
          coords: {
            x1: triW / 2,
            y1: 0, // TOP (near circle)
            x2: triW / 2,
            y2: triH, // BOTTOM (arrow direction)
          },
          colorStops: [
            { offset: 0, color: '#FFDE21', opacity: 0.6 }, // strong near black circle
            { offset: 0.5, color: '#FFDE21', opacity: 0.3 }, // softer mid-glow
            { offset: 0.85, color: '#FFDE21', opacity: 0.1 }, // softer mid-glow
            { offset: 1, color: '#FFDE21', opacity: 0.0 },
          ],
        }),
        // opacity: 0.3,
        left: radius,
        top: radius * 4.2,
        originX: 'left',
        originY: 'center',
      });
      assignCategory(lightTriangle, ComponentType.Overlay);

      // Create the circle with stroke only, no shadow
      const circle = new fabric.Circle({
        left: 0,
        top: 0,
        radius: radius,
        fill: '',
        stroke: '#000',
        strokeWidth: strokeWidth,
        originX: 'center',
        originY: 'center',
      });

      // Create the arrow shaft (rectangle)
      const arrowShaft = new fabric.Rect({
        left: radius * 0.1,
        top: 0,
        width: arrowLength,
        height: strokeWidth,
        fill: '#000',
        originX: 'left',
        originY: 'center',
      });

      // Create the arrow head (triangle)
      const arrowHead = new fabric.Triangle({
        left: radius * 0.1 + arrowLength + arrowHeadSize / 2,
        top: 0,
        width: arrowHeadSize,
        height: arrowHeadSize,
        fill: '#000',
        angle: 90,
        originX: 'center',
        originY: 'center',
      });

      // Group all elements together (light triangle in back)
      const group = new fabric.Group([lightTriangle, circle, arrowShaft, arrowHead], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });
      group?.set('name', name);
      group?.set('shapeType', name);
      group?.set('shapeId', shapeId);
      if (reason) {
        group?.set('reason', reason);
      }
      assignCategory(group, ComponentType.Light);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      return group;
    },

    presenceSensor: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const radius = options.radius || 50;
      const diameter = radius * 2;
      const strokeWidth = getProportionalStrokeWidth(radius * 2); // Use diameter as base size
      const arrowLength = radius * 1.7;
      const arrowHeadSize = Math.max(4, radius * 0.32);

      const triW = diameter * 6;
      const triH = radius * 4;

      const lightTriangle = new fabric.Triangle({
        width: triW,
        height: triH,
        angle: 270,
        fill: new fabric.Gradient({
          type: 'linear',
          gradientUnits: 'pixels',
          coords: {
            x1: triW / 2,
            y1: 0, // TOP (near circle)
            x2: triW / 2,
            y2: triH, // BOTTOM (arrow direction)
          },
          colorStops: [
            { offset: 0, color: '#75F0A8', opacity: 0.6 }, // strong near black circle
            { offset: 0.5, color: '#75F0A8', opacity: 0.3 }, // softer mid-glow
            { offset: 0.85, color: '#75F0A8', opacity: 0.1 }, // softer mid-glow
            { offset: 1, color: '#75F0A8', opacity: 0.0 },
          ],
        }),
        left: radius * 2,
        top: diameter * 3,
        originX: 'left',
        originY: 'center',
      });
      assignCategory(lightTriangle, ComponentType.Overlay);

      // Create the circle with stroke only, no shadow
      const circle = new fabric.Circle({
        left: 0,
        top: 0,
        radius: radius,
        fill: '',
        stroke: '#000',
        strokeWidth: strokeWidth,
        originX: 'center',
        originY: 'center',
      });

      // Create the arrow shaft (rectangle)
      const arrowShaft = new fabric.Rect({
        left: -arrowLength - radius * 0.1,
        top: 0,
        width: arrowLength,
        height: strokeWidth,
        fill: '#000',
        originX: 'left',
        originY: 'center',
      });

      // Create the arrow head (triangle)
      const arrowHead = new fabric.Triangle({
        left: 0,
        top: 0,
        width: arrowHeadSize,
        height: arrowHeadSize,
        fill: '#000',
        angle: 90, // Rotate to point right
        originX: 'center',
        originY: 'center',
      });

      // Group all elements together
      const group = new fabric.Group([lightTriangle, circle, arrowShaft, arrowHead], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });
      group?.set('name', name);
      group?.set('shapeType', name);
      group?.set('shapeId', shapeId);
      if (reason) {
        group?.set('reason', reason);
      }
      assignCategory(group, ComponentType.Switch);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      return group;
    },

    addArrowShape: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      // Get size from options or use default
      const radius = options.radius || 40; // Increased default size
      const baseSize = radius; // Increased default size
      const scaleFactor = (baseSize * 2) / 40; // Scale factor based on 80px default

      // Create rounded shaft (thin rectangle with rounded ends)
      const shaftWidth = 20 * scaleFactor;
      const shaftHeight = 14 * scaleFactor;
      const arrowHeadWidth = 40 * scaleFactor;
      const arrowHeadHeight = 40 * scaleFactor;

      const circle = new fabric.Circle({
        left: 0,
        top: 0,
        radius: radius,
        fill: '',
        stroke: '#000',
        strokeWidth: 0,
        originX: 'center',
        originY: 'center',
      });

      const triW = radius * 8;
      const triH = radius * 4;

      const lightTriangle = new fabric.Triangle({
        width: triW,
        height: triH,
        angle: 270,
        fill: new fabric.Gradient({
          type: 'linear',
          gradientUnits: 'pixels',
          coords: {
            x1: triW / 2,
            y1: 0, // TOP (near circle)
            x2: triW / 2,
            y2: triH, // BOTTOM (arrow direction)
          },
          colorStops: [
            { offset: 0, color: '#FFDE21', opacity: 0.6 }, // strong near black circle
            { offset: 0.5, color: '#FFDE21', opacity: 0.3 }, // softer mid-glow
            { offset: 0.85, color: '#FFDE21', opacity: 0.1 }, // softer mid-glow
            { offset: 1, color: '#FFDE21', opacity: 0.0 },
          ],
        }),
        // opacity: 0.3,
        left: radius,
        top: radius * 4.2,
        originX: 'left',
        originY: 'center',
      });

      assignCategory(lightTriangle, ComponentType.Overlay);

      const shaft = new fabric.Rect({
        left: -shaftWidth / 0.8, // Make left position proportional to shaft width
        top: 0,
        width: shaftWidth,
        height: shaftHeight,
        fill: '#000000',
        rx: shaftHeight / 2, // Rounded corners (half of height for full rounding)
        ry: shaftHeight / 2,
        originX: 'center',
        originY: 'center',
      });

      const arrowHead = new fabric.Triangle({
        left: 0,
        top: 0,
        width: arrowHeadWidth,
        height: arrowHeadHeight,
        fill: '#000000',
        angle: 90, // Rotate to point right
        originX: 'center',
        originY: 'center',
      });

      // Group shaft and head together
      const arrowGroup = new fabric.Group([circle, lightTriangle, shaft, arrowHead], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });
      arrowGroup?.set('name', name);
      arrowGroup?.set('shapeType', name);
      arrowGroup?.set('shapeId', shapeId);
      if (reason) {
        arrowGroup?.set('reason', reason);
      }
      assignCategory(arrowGroup, ComponentType.Light);
      canvas.add(arrowGroup);
      canvas.setActiveObject(arrowGroup);
      canvas.renderAll();
      return arrowGroup;
    },

    addGlowingRectangle: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const width = options.width || 200;
      const height = (options.width || 10) * 0.15;
      const strokeWidth = getProportionalStrokeWidth(width);

      // Set a fixed corner radius that won't change with scaling
      const fixedCornerRadius = Math.min(width, height);

      // Glowing background rectangle
      const glowRect = new fabric.Rect({
        left: 0,
        top: 0,
        width: width * 4,
        height: width * 2,
        // opacity: glowOpacity,
        rx: fixedCornerRadius,
        ry: fixedCornerRadius,
        originX: 'center',
        originY: 'center',
      });
      // Apply radial gradient like glowing circle (strong center, fade to all sides)
      const glowW = width * 4;
      const glowH = width * 2;
      const centerX = glowW / 2;
      const centerY = glowH / 2;
      const innerR = Math.max(width, height) * 0.5; // strong near fixture
      const outerR = Math.max(glowW, glowH) * 0.65; // fade out towards edges
      glowRect.set(
        'fill',
        new fabric.Gradient({
          type: 'radial',
          gradientUnits: 'pixels',
          coords: {
            x1: centerX,
            y1: centerY,
            r1: innerR,
            x2: centerX,
            y2: centerY,
            r2: outerR,
          },
          colorStops: [
            { offset: 0, color: '#FFDE21', opacity: 0.35 },
            { offset: 0.5, color: '#FFDE21', opacity: 0.2 },
            { offset: 0.85, color: '#FFDE21', opacity: 0.08 },
            { offset: 1, color: '#FFDE21', opacity: 0.0 },
          ],
        })
      );

      assignCategory(glowRect, ComponentType.Overlay);

      // Main outlined rectangle
      const rect = new fabric.Rect({
        left: 0,
        top: 0,
        width: width,
        height: height,
        fill: '',
        stroke: '#000000',
        strokeWidth: strokeWidth,
        strokeUniform: true,
        originX: 'center',
        originY: 'center',
      });

      // Group them together
      const group = new fabric.Group([glowRect, rect], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });

      group?.set('name', name);
      group?.set('shapeType', name);
      group?.set('shapeId', shapeId);
      if (reason) {
        group?.set('reason', reason);
      }

      assignCategory(group, ComponentType.Light);
      canvas.add(group);
      // Allow only horizontal scaling for pendant linear (length change)
      group.setControlsVisibility({
        ml: true,
        mr: true,
      });
      group.lockScalingY = true;

      // Store the original corner radius for consistent scaling
      const originalCornerRadius = fixedCornerRadius;

      group.on('scaling', () => {
        const glowRect = group.item(0);
        const scaleX = group.scaleX || 1;
        const scaleY = group.scaleY || 1;

        // Calculate the new corner radius that maintains the same visual appearance
        // Divide by scale to counteract the scaling effect
        const newCornerRadius = originalCornerRadius / Math.min(scaleX, scaleY);

        glowRect.set({
          rx: newCornerRadius,
          ry: newCornerRadius,
        });

        canvas.renderAll();
      });

      canvas.setActiveObject(group);
      canvas.renderAll();
      return group;
    },

    addParallelLines: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const lineLength = options.width || 200;
      const strokeWidth = getProportionalStrokeWidth(lineLength); // Use line length as base size
      const lineSpacing = strokeWidth * 1.5; // Proportional spacing
      const glowHeight = strokeWidth * 10; // Proportional glow height

      // Create first line
      const line1 = new fabric.Line([0, 0, lineLength, 0], {
        stroke: '#000000',
        strokeWidth: strokeWidth,
        originX: 'center',
        originY: 'center',
      });

      // Create second line
      const line2 = new fabric.Line([0, lineSpacing, lineLength, lineSpacing], {
        stroke: '#000000',
        strokeWidth: strokeWidth,
        originX: 'center',
        originY: 'center',
      });

      const glowRect = new fabric.Rect({
        left: lineLength / 2,
        top: lineSpacing * 3,
        width: lineLength,
        height: glowHeight,
        originX: 'center',
        originY: 'center',
      });
      // Apply vertical gradient (strong near lines at top, fading to bottom)
      glowRect.set(
        'fill',
        new fabric.Gradient({
          type: 'linear',
          gradientUnits: 'pixels',
          coords: {
            x1: lineLength / 2,
            y1: 0, // top of glow rect (near lines)
            x2: lineLength / 2,
            y2: glowHeight, // bottom of glow rect
          },
          colorStops: [
            { offset: 0, color: '#FFDE21', opacity: 0.45 },
            { offset: 0.4, color: '#FFDE21', opacity: 0.25 },
            { offset: 0.8, color: '#FFDE21', opacity: 0.1 },
            { offset: 1, color: '#FFDE21', opacity: 0.0 },
          ],
        })
      );

      assignCategory(glowRect, ComponentType.Overlay);

      // Group both lines together
      const group = new fabric.Group([line1, line2, glowRect], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });
      group?.set('name', name);
      group?.set('shapeType', name);
      group?.set('shapeId', shapeId);
      if (reason) {
        group?.set('reason', reason);
      }
      assignCategory(group, ComponentType.Light);
      canvas.add(group);
      group.setControlsVisibility({
        ml: true,
        mr: true,
      });
      canvas.setActiveObject(group);
      canvas.renderAll();
      return group;
    },
    // D shape
    addLetterDShape: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const length = options.width || 100;
      const strokeWidth = getProportionalStrokeWidth(length);
      const height = length * 0.3;
      // Create rounded shaft (thin rectangle with rounded ends)
      const rect = new fabric.Rect({
        fill: 'rgba(0, 255, 255, 0)',
        stroke: '#000',
        strokeWidth: strokeWidth,
        ...options,
        left: -length / 1.9,
        top: -height / 2,
        width: length,
        height: height,
      });

      // Define "D" path - properly proportioned for the slimmer rectangle
      const letterDPath = `M -8 -12 
                L -8 12 
                L -2 12 
                C 4 12 6 6 6 0 
                C 6 -6 4 -12 -2 -12 
                Z`;

      const scaleX = length / 100; // original width was ~24
      const scaleY = height / 80;

      const letterD = new fabric.Path(letterDPath, {
        left: 0,
        top: 0,
        fill: null, // No fill
        stroke: '#000', // Black stroke
        strokeWidth: 4,
        originX: 'center',
        originY: 'center',
        scaleX: scaleX,
        scaleY: scaleY,
      });

      // Group shaft and "D" shape together
      const group = new fabric.Group([rect, letterD], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });
      group?.set('name', name);
      group?.set('shapeType', name);
      group?.set('shapeId', shapeId);
      if (reason) {
        group?.set('reason', reason);
      }
      assignCategory(group, ComponentType.Switch);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      return group;
    },

    //addCircleX
    addCircleX: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const radius = options.radius || 10;
      const strokeWidth = getProportionalStrokeWidth(radius * 2); // Use diameter as base size

      // Circle
      const circle = new fabric.Circle({
        left: 0,
        top: 0,
        radius: radius,
        fill: '',
        stroke: '#000000',
        strokeWidth: strokeWidth,
        originX: 'center',
        originY: 'center',
      });

      // X lines - length is 60% of diameter
      const lineLength = radius * 0.7;

      const line1 = new fabric.Line(
        [-lineLength / 2, -lineLength / 2, lineLength / 2, lineLength / 2],
        {
          stroke: '#000000',
          strokeWidth: strokeWidth,
          originX: 'center',
          originY: 'center',
        }
      );

      const line2 = new fabric.Line(
        [lineLength / 2, -lineLength / 2, -lineLength / 2, lineLength / 2],
        {
          stroke: '#000000',
          strokeWidth: strokeWidth,
          originX: 'center',
          originY: 'center',
        }
      );

      // Outer translucent circle for light effect
      const outerCircle = new fabric.Circle({
        left: 0,
        top: 0,
        radius: radius * 4, // dynamically scale glow area
        // opacity: 0.3,
        strokeWidth: 0,
        originX: 'center',
        originY: 'center',
      });
      const glowR = radius * 4;
      outerCircle.set(
        'fill',
        new fabric.Gradient({
          type: 'radial',
          gradientUnits: 'pixels', // << important
          coords: {
            x1: glowR,
            y1: glowR,
            r1: radius, // inner center & radius (near black ring)
            x2: glowR,
            y2: glowR,
            r2: glowR, // outer center & radius (edge of glow)
          },
          colorStops: [
            { offset: 0, color: '#FFDE21', opacity: 0.6 }, // strong near black circle
            { offset: 0.5, color: '#FFDE21', opacity: 0.3 }, // softer mid-glow
            { offset: 0.85, color: '#FFDE21', opacity: 0.1 }, // softer mid-glow
            { offset: 1, color: '#FFDE21', opacity: 0.0 },
          ],
        })
      );

      assignCategory(outerCircle, ComponentType.Overlay);
      // Group them all
      const group = new fabric.Group([outerCircle, circle, line1, line2], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });
      group?.set('name', name);
      group?.set('shapeType', name);
      group?.set('shapeId', shapeId);
      if (reason) {
        group?.set('reason', reason);
      }
      assignCategory(group, ComponentType.Light);
      canvas.add(group);
      group.setControlsVisibility({
        mtr: false,
      });
      canvas.setActiveObject(group);
      canvas.renderAll();
      return group;
    },

    // Sconce Vertical: similar to pendant glow circle but cropped on the left
    addSconceVertica: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const radius = options.radius || 20;
      const strokeWidth = getProportionalStrokeWidth(radius * 2);

      // Core circle with stroke
      const innerCircle = new fabric.Circle({
        left: 0,
        top: 0,
        radius,
        fill: '',
        stroke: '#000',
        strokeWidth,
        originX: 'center',
        originY: 'center',
      });

      const lineLength = radius * 0.7;

      const line1 = new fabric.Line(
        [-lineLength / 2, -lineLength / 2, lineLength / 2, lineLength / 2],
        {
          stroke: '#000000',
          strokeWidth: strokeWidth,
          originX: 'center',
          originY: 'center',
        }
      );

      const line2 = new fabric.Line(
        [lineLength / 2, -lineLength / 2, -lineLength / 2, lineLength / 2],
        {
          stroke: '#000000',
          strokeWidth: strokeWidth,
          originX: 'center',
          originY: 'center',
        }
      );

      // Radial glow like other lights
      const glowR = radius * 4.5;
      const outerGlow = new fabric.Circle({
        left: 0,
        top: 0,
        radius: glowR,
        strokeWidth: 0,
        originX: 'center',
        originY: 'center',
      });
      outerGlow.set(
        'fill',
        new fabric.Gradient({
          type: 'radial',
          gradientUnits: 'pixels',
          coords: { x1: glowR, y1: glowR, r1: radius, x2: glowR, y2: glowR, r2: glowR },
          colorStops: [
            { offset: 0, color: '#FFDE21', opacity: 0.45 },
            { offset: 0.5, color: '#FFDE21', opacity: 0.25 },
            { offset: 0.85, color: '#FFDE21', opacity: 0.08 },
            { offset: 1, color: '#FFDE21', opacity: 0.0 },
          ],
        })
      );
      assignCategory(outerGlow, ComponentType.Overlay);

      // Crop mask on the left to flatten a slice of the circle (sconce look)
      const cropWidth = radius * 2.5; // how much to crop on left
      const leftCut = new fabric.Rect({
        left: -glowR * 1,
        top: -glowR,
        width: cropWidth,
        height: glowR * 2,
        fill: '#fff',
        originX: 'left',
        originY: 'top',
      });
      // Use destination-out like effect via even-odd rule by setting clipPath with inverted flag
      // Fabric supports clipPath with objects having inverted=true
      leftCut.inverted = true;
      outerGlow.clipPath = leftCut; // crop only the left portion from glow

      // Small left connector line
      const connector = new fabric.Line([-radius * 1, 0, -radius * 1.9, 0], {
        stroke: '#000',
        strokeWidth,
        originX: 'center',
        originY: 'center',
      });

      const group = new fabric.Group([outerGlow, innerCircle, connector, line1, line2], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });
      group?.set('name', name);
      group?.set('shapeType', name);
      group?.set('shapeId', shapeId);
      if (reason) group?.set('reason', reason);
      assignCategory(group, ComponentType.Light);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      return group;
    },

    // Sconce Directional: horizontal sconce with left-pointing arrow
    addSconceDirectional: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const radius = options.radius || 20;
      const strokeWidth = getProportionalStrokeWidth(radius * 2);

      // Core circle with stroke
      const innerCircle = new fabric.Circle({
        left: 0,
        top: 0,
        radius,
        fill: '',
        stroke: '#000',
        strokeWidth,
        originX: 'center',
        originY: 'center',
      });
      const lineLength = radius * 0.7;

      const line1 = new fabric.Line(
        [-lineLength / 2, -lineLength / 2, lineLength / 2, lineLength / 2],
        {
          stroke: '#000000',
          strokeWidth: strokeWidth,
          originX: 'center',
          originY: 'center',
        }
      );

      const line2 = new fabric.Line(
        [lineLength / 2, -lineLength / 2, -lineLength / 2, lineLength / 2],
        {
          stroke: '#000000',
          strokeWidth: strokeWidth,
          originX: 'center',
          originY: 'center',
        }
      );

      // Directional arrow pointing left - two lines forming arrowhead
      const arrowLength = radius * 2;
      const arrowHeight = radius * 1.3;
      const arrowCenterX = -radius * 0.01; // Position to the left of the circle

      // Top arrow line (diagonal up-left)
      const line3 = new fabric.Line([arrowCenterX, -arrowHeight, arrowCenterX - arrowLength, 0], {
        stroke: '#000000',
        strokeWidth: strokeWidth,
        originX: 'center',
        originY: 'center',
      });

      // Bottom arrow line (diagonal down-left)
      const line4 = new fabric.Line([arrowCenterX, arrowHeight, arrowCenterX - arrowLength, 0], {
        stroke: '#000000',
        strokeWidth: strokeWidth,
        originX: 'center',
        originY: 'center',
      });

      // Radial glow like other lights
      const glowR = radius * 4.5;
      const outerGlow = new fabric.Circle({
        left: 0,
        top: 0,
        radius: glowR,
        strokeWidth: 0,
        originX: 'center',
        originY: 'center',
      });
      outerGlow.set(
        'fill',
        new fabric.Gradient({
          type: 'radial',
          gradientUnits: 'pixels',
          coords: { x1: glowR, y1: glowR, r1: radius, x2: glowR, y2: glowR, r2: glowR },
          colorStops: [
            { offset: 0, color: '#FFDE21', opacity: 0.45 },
            { offset: 0.5, color: '#FFDE21', opacity: 0.25 },
            { offset: 0.85, color: '#FFDE21', opacity: 0.08 },
            { offset: 1, color: '#FFDE21', opacity: 0.0 },
          ],
        })
      );
      assignCategory(outerGlow, ComponentType.Overlay);

      // Crop mask on the left to flatten a slice of the circle (sconce look)
      const cropWidth = radius * 2.5; // how much to crop on left
      const leftCut = new fabric.Rect({
        left: -glowR * 1,
        top: -glowR,
        width: cropWidth,
        height: glowR * 2,
        fill: '#fff',
        originX: 'left',
        originY: 'top',
      });
      // Use destination-out like effect via even-odd rule by setting clipPath with inverted flag
      // Fabric supports clipPath with objects having inverted=true
      leftCut.inverted = true;
      outerGlow.clipPath = leftCut; // crop only the left portion from glow

      const group = new fabric.Group([outerGlow, innerCircle, line1, line2, line3, line4], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });
      group?.set('name', name);
      group?.set('shapeType', name);
      group?.set('shapeId', shapeId);
      if (reason) group?.set('reason', reason);
      assignCategory(group, ComponentType.Light);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      return group;
    },

    // Sconce Wash: half circle design
    addSconceWash: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const radius = options.radius || 20;
      const strokeWidth = getProportionalStrokeWidth(radius * 2);

      const circle = new fabric.Circle({
        left: 0,
        top: 0,
        radius: radius,
        fill: '',
        stroke: '#000',
        strokeWidth: 0,
        originX: 'center',
        originY: 'center',
      });

      // Core half circle (semicircle) with flat side to the right
      const innerSemicircle = new fabric.Path(
        `M 0 ${-radius} A ${radius} ${radius} 0 0 0 0 ${radius} Z`,
        {
          left: 0,
          top: 0,
          fill: '',
          stroke: '#000',
          strokeWidth,
          originX: 'center',
          originY: 'center',
        }
      );

      // Radial glow like other lights
      const triW = radius * 8;
      const triH = radius * 4;

      const lightTriangle = new fabric.Triangle({
        width: triW,
        height: triH,
        angle: 90,
        fill: new fabric.Gradient({
          type: 'linear',
          gradientUnits: 'pixels',
          coords: {
            x1: triW / 2,
            y1: 0, // TOP (near circle)
            x2: triW / 2,
            y2: triH, // BOTTOM (arrow direction)
          },
          colorStops: [
            { offset: 0, color: '#FFDE21', opacity: 0.6 }, // strong near black circle
            { offset: 0.5, color: '#FFDE21', opacity: 0.3 }, // softer mid-glow
            { offset: 0.85, color: '#FFDE21', opacity: 0.1 }, // softer mid-glow
            { offset: 1, color: '#FFDE21', opacity: 0.0 },
          ],
        }),
        // opacity: 0.3,
        // left: radius,
        top: -radius * 4,
        originX: 'left',
        originY: 'center',
      });
      assignCategory(lightTriangle, ComponentType.Overlay);

      // Crop mask to cut the tip of the triangle and make it flat
      const rightCut = new fabric.Rect({
        left: -triW * 0.5, // Start from the leftmost point of the triangle
        top: -triH / 2, // Align with the top of the triangle
        width: triW, // Width of the area to be clipped (from left edge to cut position)
        height: triH * 0.35, // Full height of the triangle
        fill: '#fff',
        originX: 'left',
        originY: 'top',
      });
      // Use destination-out like effect via even-odd rule by setting clipPath with inverted flag
      // Fabric supports clipPath with objects having inverted=true
      rightCut.inverted = true;
      lightTriangle.clipPath = rightCut; // cut the tip to make flat edge

      // Small left connector line
      const connector = new fabric.Line([-radius * 0.5, 0, -radius * 1.6, 0], {
        stroke: '#000',
        strokeWidth,
        originX: 'center',
        originY: 'center',
      });

      const group = new fabric.Group([circle, lightTriangle, innerSemicircle, connector], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });
      group?.set('name', name);
      group?.set('shapeType', name);
      group?.set('shapeId', shapeId);
      if (reason) group?.set('reason', reason);
      assignCategory(group, ComponentType.Light);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      return group;
    },

    // Chandelier: 6 small circles in hexagonal pattern with small glows
    addChandelier: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const radius = options.radius || 20;
      const strokeWidth = getProportionalStrokeWidth(radius * 2);
      const hexRadius = radius * 5; // Distance from center to each circle
      const glowRadius = radius * 3; // Small glow around each circle

      const circles: fabric.Object[] = [];

      // Create 6 circles arranged in a hexagon - rotated so one is at top, two on each side
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + Math.PI / 6; // 60 degrees apart, rotated 30 degrees
        const x = Math.cos(angle) * hexRadius;
        const y = Math.sin(angle) * hexRadius;

        // Small circle
        const smallCircle = new fabric.Circle({
          left: x,
          top: y,
          radius: radius,
          fill: '',
          stroke: '#000',
          strokeWidth: strokeWidth,
          originX: 'center',
          originY: 'center',
        });

        // Small glow around each circle
        const smallGlow = new fabric.Circle({
          left: x,
          top: y,
          radius: glowRadius,
          // fill: '#FFDE21',
          originX: 'center',
          originY: 'center',
        });

        smallGlow.set(
          'fill',
          new fabric.Gradient({
            type: 'radial',
            gradientUnits: 'pixels', // << important
            coords: {
              x1: glowRadius,
              y1: glowRadius,
              r1: radius, // inner center & radius (near black ring)
              x2: glowRadius,
              y2: glowRadius,
              r2: glowRadius, // outer center & radius (edge of glow)
            },
            colorStops: [
              { offset: 0, color: '#FFDE21', opacity: 0.6 }, // strong near black circle
              { offset: 0.5, color: '#FFDE21', opacity: 0.3 }, // softer mid-glow
              { offset: 0.85, color: '#FFDE21', opacity: 0.1 }, // softer mid-glow
              { offset: 1, color: '#FFDE21', opacity: 0.0 },
            ],
          })
        );
        assignCategory(smallGlow, ComponentType.Overlay);

        circles.push(smallGlow, smallCircle);
      }

      const group = new fabric.Group(circles, {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        ...options,
      });
      group?.set('name', name);
      group?.set('shapeType', name);
      group?.set('shapeId', shapeId);
      if (reason) group?.set('reason', reason);
      assignCategory(group, ComponentType.Light);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      return group;
    },

    // addRectangle: (
    //   name: string,
    //   shapeId: number,
    //   options: ShapeOptions = {},
    //   reason?: string
    // ): fabric.Rect => {
    //   const width = options.width || 200;
    //   const height = options.height || 100;
    //   const strokeWidth = getProportionalStrokeWidth(Math.max(width, height));

    //   const rect = new fabric.Rect({
    //     left: center.x,
    //     top: center.y,
    //     width: width,
    //     height: height,
    //     fill: null,
    //     stroke: '#FFDE21',
    //     strokeWidth: strokeWidth,
    //     originX: 'center',
    //     originY: 'center',
    //     ...options,
    //   });
    //   rect?.set('name', name);
    //   rect?.set('shapeId', shapeId);
    //   if (reason) {
    //     rect?.set('reason', reason);
    //   }
    //   assignCategory(rect, ComponentType.Shape);
    //   canvas.add(rect);
    //   canvas.setActiveObject(rect);
    //   canvas.renderAll();
    //   return rect;
    // },

    addPolygon: (
      name: string,
      shapeId: number,
      setIsDrawingPolygon,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Polygon => {
      const points: { x: number; y: number }[] = [];
      const circles: fabric.Circle[] = [];
      const lines: fabric.Line[] = [];
      let isDrawing = false;
      let originalContextMenu:
        | ((this: GlobalEventHandlers, ev: MouseEvent) => void | false)
        | null = null;
      let polygon: fabric.Polygon | null = null;
      const PROXIMITY_THRESHOLD = 10; // Pixels threshold for proximity checks

      const mouseDownHandler = (event: fabric.TEvent) => {
        if (!isDrawing) return;

        const isLeftClick = (event.e as MouseEvent).button === 0;
        if (!isLeftClick) return;

        const pointer = canvas.getPointer(event.e);
        const point = { x: pointer.x, y: pointer.y };

        // Check if clicking near the first point to close the polygon
        if (points.length >= 3) {
          const firstPoint = points[0];
          const distanceToFirstPoint = Math.hypot(
            firstPoint.x - pointer.x,
            firstPoint.y - pointer.y
          );

          if (distanceToFirstPoint < PROXIMITY_THRESHOLD) {
            finishPolygon();
            return;
          }
        }

        // Prevent adding points too close to existing points
        const tooCloseToExisting = points.some(
          p => Math.hypot(p.x - pointer.x, p.y - pointer.y) < PROXIMITY_THRESHOLD
        );
        if (tooCloseToExisting) return;

        points.push(point);

        const circle = new fabric.Circle({
          left: point.x,
          top: point.y,
          radius: 4,
          fill: 'blue',
          stroke: 'blue',
          strokeWidth: 2,
          selectable: false,
          evented: false,
          originX: 'center',
          originY: 'center',
          shouldNotStoreInHistory: true,
        });

        canvas.add(circle);
        circles.push(circle);

        if (points.length > 1) {
          const prevPoint = points[points.length - 2];
          const line = new fabric.Line([prevPoint.x, prevPoint.y, point.x, point.y], {
            stroke: '#CDE4EF',
            strokeWidth: 4,
            selectable: false,
            evented: false,
            opacity: 0.7,
            shouldNotStoreInHistory: true,
            shadow: new fabric.Shadow({
              color: '#CDE4EF',
              blur: 15,
              offsetX: 0,
              offsetY: 0,
              affectStroke: true,
            }),
          });
          canvas.add(line);
          lines.push(line);
        }
        canvas.renderAll();
      };

      const contextMenuHandler = (event: MouseEvent) => {
        if (!isDrawing) return;
        event.preventDefault();
        event.stopPropagation();
        finishPolygon();
        return false;
      };

      const keyDownHandler = (event: KeyboardEvent) => {
        if (!isDrawing) return;

        if (event.key === 'Escape') {
          event.preventDefault();
          cancelDrawing();
        }
      };

      const cancelDrawing = () => {
        // Clean up temporary drawing elements
        circles.forEach(circle => canvas.remove(circle));
        lines.forEach(line => canvas.remove(line));

        // Reset state
        points.length = 0;
        circles.length = 0;
        lines.length = 0;

        setIsDrawingPolygon(false);
        cleanupDrawing();

        toast.info('Polygon drawing cancelled');
      };

      const finishPolygon = () => {
        if (points.length < 3) {
          toast.error('A polygon must have at least 3 points.');
          return;
        }

        // Clean up temporary drawing elements
        circles.forEach(circle => canvas.remove(circle));
        lines.forEach(line => canvas.remove(line));

        // // Calculate average size of polygon for stroke width
        // const avgSize =
        //   points.reduce((sum, point, index) => {
        //     if (index === 0) return 0;
        //     const prevPoint = points[index - 1];
        //     return (
        //       sum +
        //       Math.sqrt(Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.y - prevPoint.y, 2))
        //     );
        //   }, 0) / Math.max(1, points.length - 1);

        // const strokeWidth = getProportionalStrokeWidth(avgSize);

        polygon = new fabric.Polygon(points, {
          fill: null,
          stroke: '#CDE4EF',
          strokeWidth: 4,
          ...options,
        });
        polygon?.set('name', name);
        polygon?.set('shapeType', name);
        polygon?.set('roomName', name);
        polygon?.set('shapeId', shapeId);
        if (reason) {
          polygon?.set('reason', reason);
        }
        assignCategory(polygon, ComponentType.Shape);
        canvas.add(polygon);
        canvas.setActiveObject(polygon);
        canvas.renderAll();

        polygon.on('modified', () => {
          if (polygon) {
            polygon.setCoords();
            canvas.requestRenderAll();
          }
        });

        setIsDrawingPolygon(false);
        cleanupDrawing();
      };

      const cleanupDrawing = () => {
        isDrawing = false;
        // points.length = 0;
        circles.length = 0;
        lines.length = 0;

        canvas.off('mouse:down', mouseDownHandler);
        document.removeEventListener('keydown', keyDownHandler);
        if (canvas.upperCanvasEl && originalContextMenu !== null) {
          canvas.upperCanvasEl.oncontextmenu = originalContextMenu;
        }
      };

      const startDrawing = () => {
        isDrawing = true;
        setIsDrawingPolygon(true);

        if (canvas.upperCanvasEl) {
          originalContextMenu = canvas.upperCanvasEl.oncontextmenu as
            | ((this: GlobalEventHandlers, ev: MouseEvent) => void | false)
            | null;
          canvas.upperCanvasEl.oncontextmenu = contextMenuHandler;
        }

        canvas.on('mouse:down', mouseDownHandler);
        document.addEventListener('keydown', keyDownHandler);
      };

      startDrawing();

      return polygon!;
    },

    addLetterSShape: (
      name: string,
      shapeId: number,
      options: ShapeOptions = {},
      reason?: string
    ): fabric.Group => {
      const defaultLength = 100; // default width if none provided
      const length = options.width ?? defaultLength;

      const textS = new fabric.FabricText('S', {
        fontSize: length,
        fill: '#000',
        left: 0,
        top: 0,
        originX: 'center',
        originY: 'center',
      });

      // Group shaft and "S" shape together
      const group = new fabric.Group([textS], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        // scaleX,
        // scaleY,
        ...options,
      });
      group?.set('name', name);
      group?.set('shapeType', name);
      group?.set('shapeId', shapeId);
      if (reason) {
        group?.set('reason', reason);
      }
      assignCategory(group, ComponentType.Switch);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      return group;
    },

    addGlowingLine: (
      name: string,
      shapeId: number,
      setIsDrawingLine: (drawing: boolean) => void,
      options: ShapeOptions = {},
      reason?: string
    ): void => {
      let isDrawing = false;
      const points: { x: number; y: number }[] = [];
      const tempLine: fabric.Line | null = null;
      let tempPoint: fabric.Circle | null = null;
      let line: fabric.Line | null = null;
      let originalContextMenu:
        | ((this: GlobalEventHandlers, ev: MouseEvent) => void | false)
        | null = null;
      const ENDPOINT_RADIUS = 7;
      const ENDPOINT_COLOR = 'blue';
      const ENDPOINT_STROKE = 'white';
      const ENDPOINT_STROKE_WIDTH = 2;

      // --- Drawing Handlers ---
      const mouseDownHandler = (event: fabric.TEvent) => {
        if (!isDrawing) return;
        const pointer = canvas.getScenePoint(event.e);
        points.push({ x: pointer.x, y: pointer.y });

        if (points.length === 1) {
          // Show first endpoint
          const point = new fabric.Circle({
            left: pointer.x,
            top: pointer.y,
            radius: ENDPOINT_RADIUS,
            fill: ENDPOINT_COLOR,
            stroke: ENDPOINT_STROKE,
            strokeWidth: ENDPOINT_STROKE_WIDTH,
            selectable: false,
            evented: false,
            originX: 'center',
            originY: 'center',
            shouldNotStoreInHistory: true,
          });
          tempPoint = point;
          canvas.add(point);
          canvas.renderAll();
        } else if (points.length === 2) {
          // Draw the line
          const [p1, p2] = points;
          const strokeWidth = 4;
          line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
            stroke: '#FFDE21',
            strokeWidth: strokeWidth,
            originX: 'center',
            originY: 'center',
            ...options,
          });
          line?.set('name', name);
          line?.set('shapeType', name);
          line?.set('shapeId', shapeId);
          if (reason) {
            line?.set('reason', reason);
          }
          assignCategory(line, ComponentType.Shape);
          canvas.add(line);
          canvas.setActiveObject(line);
          canvas.renderAll();

          // Remove temp point
          if (tempPoint) {
            canvas.remove(tempPoint);
            tempPoint = null;
          }
          // Attach edit mode logic
          if (line) {
            toggleLineEditMode(line, canvas);
          }
          setIsDrawingLine(false);
          isDrawing = false;
        }
      };

      const keyDownHandler = (event: KeyboardEvent) => {
        if (!isDrawing) return;
        if (event.key === 'Escape') {
          cancelDrawing();
        }
      };

      const contextMenuHandler = (event: MouseEvent) => {
        if (!isDrawing) return;
        event.preventDefault();
        event.stopPropagation();
        cancelDrawing();
        return false;
      };

      const cancelDrawing = () => {
        if (tempLine) {
          canvas.remove(tempLine);
        }
        if (tempPoint) {
          canvas.remove(tempPoint);
        }
        points.length = 0;
        cleanupDrawing();
        setIsDrawingLine(false);
        toast.info('Line drawing cancelled');
      };

      const cleanupDrawing = () => {
        isDrawing = false;
        if (tempPoint) {
          canvas.remove(tempPoint);
        }
        setIsDrawingLine(false);
        canvas.off('mouse:down', mouseDownHandler);
        document.removeEventListener('keydown', keyDownHandler);
        if (canvas.upperCanvasEl && originalContextMenu !== null) {
          canvas.upperCanvasEl.oncontextmenu = originalContextMenu;
        }
      };

      const startDrawing = () => {
        isDrawing = true;
        setIsDrawingLine(true);
        if (canvas.upperCanvasEl) {
          originalContextMenu = canvas.upperCanvasEl.oncontextmenu as
            | ((this: GlobalEventHandlers, ev: MouseEvent) => void | false)
            | null;
          canvas.upperCanvasEl.oncontextmenu = contextMenuHandler;
        }
        canvas.on('mouse:down', mouseDownHandler);
        document.addEventListener('keydown', keyDownHandler);
      };

      // --- Start Drawing ---
      startDrawing();
    },

    drawReferenceLine: (
      name: string,
      shapeId: number,
      setIsDrawingLine,
      onLineLengthDialogOpen,
      reason?: string
    ): void => {
      let isDrawing = false;
      const points: { x: number; y: number }[] = [];
      let tempLine: fabric.Line | null = null;
      let tempPoint: fabric.Circle | null = null;
      let originalContextMenu:
        | ((this: GlobalEventHandlers, ev: MouseEvent) => void | false)
        | null = null;

      const mouseDownHandler = (event: fabric.TEvent) => {
        if (!isDrawing) return;

        const pointer = canvas.getScenePoint(event.e);
        points.push({ x: pointer.x, y: pointer.y });

        if (points.length === 1) {
          // First point: draw a round point to show where user clicked
          const point = new fabric.Circle({
            left: pointer.x,
            top: pointer.y,
            radius: 4,
            fill: '#00AAFF',
            stroke: '#00AAFF',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            originX: 'center',
            originY: 'center',
          });
          tempPoint = point;
          canvas.add(point);
          canvas.renderAll();
        } else if (points.length === 2) {
          // Second point: draw the line and finish
          const [p1, p2] = points;
          // Calculate line length for proportional stroke width
          const lineLength = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
          const strokeWidth = getProportionalStrokeWidth(lineLength);

          const line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
            stroke: '#00AAFF',
            strokeWidth: strokeWidth,
            selectable: false,
            evented: false,
            shadow: new fabric.Shadow({
              color: '#00AAFF',
              blur: 10,
              offsetX: 0,
              offsetY: 0,
              affectStroke: true,
            }),
          });
          tempLine = line;
          line?.set('name', name);
          line?.set('shapeType', name);
          line?.set('shapeId', shapeId);
          if (reason) {
            line?.set('reason', reason);
          }
          canvas.add(line);
          canvas.renderAll();

          // Calculate line length
          const length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

          // Show dialog with line length and pass the line object
          if (onLineLengthDialogOpen) {
            onLineLengthDialogOpen(length, line);
          }

          toast.success('Reference line drawn');
          cleanupDrawing();
        }
      };

      const keyDownHandler = (event: KeyboardEvent) => {
        if (!isDrawing) return;
        if (event.key === 'Escape') {
          cancelDrawing();
        }
      };

      const contextMenuHandler = (event: MouseEvent) => {
        if (!isDrawing) return;
        event.preventDefault();
        event.stopPropagation();
        cancelDrawing();
        return false;
      };

      const cancelDrawing = () => {
        if (tempLine) {
          canvas.remove(tempLine);
        }
        if (tempPoint) {
          canvas.remove(tempPoint);
        }
        points.length = 0;
        cleanupDrawing();
        toast.info('Line drawing cancelled');
      };

      const cleanupDrawing = () => {
        isDrawing = false;
        if (tempPoint) {
          canvas.remove(tempPoint);
        }
        setIsDrawingLine(false);
        canvas.off('mouse:down', mouseDownHandler);
        document.removeEventListener('keydown', keyDownHandler);
        if (canvas.upperCanvasEl && originalContextMenu !== null) {
          canvas.upperCanvasEl.oncontextmenu = originalContextMenu;
        }
      };

      const startDrawing = () => {
        isDrawing = true;
        setIsDrawingLine(true);
        canvas.on('mouse:down', mouseDownHandler);
        document.addEventListener('keydown', keyDownHandler);
        if (canvas.upperCanvasEl) {
          originalContextMenu = canvas.upperCanvasEl.oncontextmenu as
            | ((this: GlobalEventHandlers, ev: MouseEvent) => void | false)
            | null;
          canvas.upperCanvasEl.oncontextmenu = contextMenuHandler;
        }
      };

      startDrawing();
    },
  };
};
