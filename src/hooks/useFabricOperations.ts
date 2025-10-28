import { useCanvas } from '@/context/canvasContext';
import { ShapeCreators, CanvasOperations } from '@/types/fabric';
import { createCanvasOperations } from '@/utils/fabric/canvasOperations';
import { createShapes } from '@/utils/fabric/fabricShapes';
import { useMemo } from 'react';

export const useFabricShapes = (): ShapeCreators => {
  const { canvas } = useCanvas();

  return useMemo(() => {
    if (!canvas) {
      return {
        addGlowingCircle: () => undefined,
        addCircleWithArrowOut: () => undefined,
        presenceSensor: () => undefined,
        addArrowShape: () => undefined,
        addGlowingRectangle: () => undefined,
        addParallelLines: () => undefined,
        addLetterDShape: () => undefined,
        addCircleX: () => undefined,
        addSconceVertica: () => undefined,
        addSconceDirectional: () => undefined,
        addSconceWash: () => undefined,
        addChandelier: () => undefined,
        addPolygon: () => undefined,
        addGlowingLine: () => undefined,
        drawReferenceLine: () => undefined,
        addLetterSShape: () => undefined,
      };
    }

    // Create a function that calculates center of current viewport dynamically
    const getCenter = () => {
      // Get the current viewport transform
      const vpt = canvas.viewportTransform;
      if (!vpt) {
        // Fallback to canvas center if no viewport transform
        return { x: canvas.width! / 2, y: canvas.height! / 2 };
      }

      // Calculate the center of the current viewport
      // The viewport transform includes translation (vpt[4], vpt[5]) and scale (vpt[0], vpt[3])
      const scaleX = vpt[0];
      const scaleY = vpt[3];
      const translateX = vpt[4];
      const translateY = vpt[5];

      // Calculate the center of the visible area
      // This accounts for zoom and pan
      const viewportCenterX = (canvas.width! / 2 - translateX) / scaleX;
      const viewportCenterY = (canvas.height! / 2 - translateY) / scaleY;

      return { x: viewportCenterX, y: viewportCenterY };
    };

    // Override each shape creator to recalculate center on each call
    const dynamicShapeCreators: ShapeCreators = {
      addGlowingCircle: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addGlowingCircle(name, shapeId, options, reason);
      },
      addCircleWithArrowOut: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addCircleWithArrowOut(name, shapeId, options, reason);
      },
      presenceSensor: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.presenceSensor(name, shapeId, options, reason);
      },
      addArrowShape: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addArrowShape(name, shapeId, options, reason);
      },
      addGlowingRectangle: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addGlowingRectangle(name, shapeId, options, reason);
      },
      addParallelLines: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addParallelLines(name, shapeId, options, reason);
      },
      addLetterDShape: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addLetterDShape(name, shapeId, options, reason);
      },
      addCircleX: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addCircleX(name, shapeId, options, reason);
      },
      addSconceVertica: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addSconceVertica(name, shapeId, options, reason);
      },
      addSconceDirectional: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addSconceDirectional(name, shapeId, options, reason);
      },
      addSconceWash: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addSconceWash(name, shapeId, options, reason);
      },
      addChandelier: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addChandelier(name, shapeId, options, reason);
      },
      addPolygon: (name, shapeId, setIsDrawingPolygon, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addPolygon(name, shapeId, setIsDrawingPolygon, options, reason);
      },
      addGlowingLine: (name, shapeId, setIsDrawingLine, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addGlowingLine(name, shapeId, setIsDrawingLine, options, reason);
      },
      drawReferenceLine: (name, shapeId, setIsDrawingLine, onLineLengthDialogOpen, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.drawReferenceLine(
          name,
          shapeId,
          setIsDrawingLine,
          onLineLengthDialogOpen,
          reason
        );
      },
      addLetterSShape: (name, shapeId, options, reason) => {
        const currentCenter = getCenter();
        const shapes = createShapes(canvas, currentCenter);
        return shapes.addLetterSShape(name, shapeId, options, reason);
      },
    };

    return dynamicShapeCreators;
  }, [canvas]);
};

export const useFabricOperations = (): CanvasOperations => {
  const { canvas } = useCanvas();

  return useMemo(() => {
    return createCanvasOperations(canvas);
  }, [canvas]);
};
