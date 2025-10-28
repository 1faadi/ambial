import { CanvasOperations, CanvasSize } from '@/types/fabric';
import * as fabric from 'fabric';

export const createCanvasOperations = (canvas: fabric.Canvas | null): CanvasOperations => {
  if (!canvas) {
    console.warn('Canvas not available');
    return {
      selectAll: () => {},
      deleteSelected: () => {},
      zoomIn: () => {},
      zoomOut: () => {},
      resetZoom: () => {},
      clearCanvas: () => {},
      getCanvasSize: () => ({ width: 0, height: 0 }),
      updateShapeColor: () => {},
    };
  }

  const updateObjectColor = (obj: fabric.Object, color: string): void => {
    if (obj instanceof fabric.Group) {
      // Handle grouped objects (like arrows with circles)
      obj.getObjects().forEach(subObj => {
        updateObjectColor(subObj, color);
      });
    } else {
      // Update stroke color for outlined shapes
      if (obj.stroke) {
        obj.set('stroke', color);
      }

      // Update fill color if it exists and isn't transparent
      if (
        obj.fill &&
        obj.fill !== '' &&
        obj.fill !== 'rgba(0, 255, 255, 0)' &&
        obj.fill !== 'rgba(0, 255, 255, 0.05)'
      ) {
        obj.set('fill', color);
      }

      // Update shadow color if it exists
      if (obj.shadow && obj.shadow instanceof fabric.Shadow) {
        obj.shadow.color = color;
      }
    }
  };

  const updateShapeColor = (color: string): void => {
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();

    if (activeObjects.length === 0) {
      return;
    }

    activeObjects.forEach(obj => {
      updateObjectColor(obj, color);
    });

    canvas.renderAll();
  };

  return {
    selectAll: (): void => {
      const objects = canvas.getObjects();
      const selection = new fabric.ActiveSelection(objects, { canvas });
      canvas.setActiveObject(selection);
      canvas.renderAll();
    },

    deleteSelected: (): void => {
      const activeObjects = canvas.getActiveObjects();
      canvas.discardActiveObject();
      activeObjects.forEach((obj: fabric.Object) => canvas.remove(obj));
      canvas.renderAll();
    },

    zoomIn: (): void => {
      const currentZoom = canvas.getZoom();
      const newZoom = currentZoom + 0.1; // Increase by 10%
      const zoom = newZoom > 5 ? 5 : newZoom; // Max 500%

      const center = canvas.getCenterPoint();
      canvas.zoomToPoint(center, zoom);
      canvas.requestRenderAll();
    },

    zoomOut: (): void => {
      const currentZoom = canvas.getZoom();
      const newZoom = currentZoom - 0.1; // Decrease by 10%
      const zoom = newZoom < 0.1 ? 0.1 : newZoom; // Min 10%

      const center = canvas.getCenterPoint();
      canvas.zoomToPoint(center, zoom);
      canvas.requestRenderAll();
    },

    resetZoom: (): void => {
      const center = canvas.getCenterPoint();
      canvas.zoomToPoint(center, 1); // 100%
      canvas.requestRenderAll();
    },

    clearCanvas: (): void => {
      canvas.clear();
      canvas.backgroundColor = 'white';
      canvas.renderAll();
    },

    getCanvasSize: (): CanvasSize => ({
      width: canvas.getWidth(),
      height: canvas.getHeight(),
    }),

    updateShapeColor: updateShapeColor,
  };
};

// Utility: Check if a point is inside a polygon (ray-casting algorithm)
export function isPointInPolygon(
  point: { x: number; y: number },
  polygonPoints: { x: number; y: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
    const xi = polygonPoints[i].x,
      yi = polygonPoints[i].y;
    const xj = polygonPoints[j].x,
      yj = polygonPoints[j].y;
    const intersect =
      yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Utility: Calculate overlap area between object and polygon bounding boxes
export function calculateOverlapArea(obj: fabric.Object, polygon: fabric.Polygon): number {
  const objBounds = obj.getBoundingRect();
  const polygonBounds = polygon.getBoundingRect();
  const overlapX = Math.max(
    0,
    Math.min(objBounds.left + objBounds.width, polygonBounds.left + polygonBounds.width) -
      Math.max(objBounds.left, polygonBounds.left)
  );
  const overlapY = Math.max(
    0,
    Math.min(objBounds.top + objBounds.height, polygonBounds.top + polygonBounds.height) -
      Math.max(objBounds.top, polygonBounds.top)
  );
  return overlapX * overlapY;
}

// Utility: Robustly check if a fabric object is inside a polygon (center, corners, overlap)
export function isObjectInsidePolygon(obj: fabric.Object, polygon: fabric.Polygon): boolean {
  const polygonPoints = polygon.get('points').map((p: { x: number; y: number }) => {
    const x = p.x * (polygon.scaleX || 1) + (polygon.left || 0);
    const y = p.y * (polygon.scaleY || 1) + (polygon.top || 0);
    return { x, y };
  });
  let finalPolygonPoints = polygonPoints;
  try {
    const polygonCoords = polygon.getCoords();
    if (polygonCoords && polygonCoords.length > 0) {
      finalPolygonPoints = polygonCoords.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
    }
  } catch {}
  const objBounds = obj.getBoundingRect();
  const objCenter = obj.getCenterPoint();
  const isCenterInside = isPointInPolygon(objCenter, finalPolygonPoints);
  let isInside = isCenterInside;
  if (!isCenterInside && (objBounds.width > 20 || objBounds.height > 20)) {
    try {
      const corners = obj.getCoords();
      isInside = corners.some((point: { x: number; y: number }) =>
        isPointInPolygon(point, finalPolygonPoints)
      );
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
}
