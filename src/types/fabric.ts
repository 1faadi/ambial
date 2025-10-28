import * as fabric from 'fabric';

export interface CanvasSize {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ShapeOptions {
  left?: number;
  top?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  width?: number;
  height?: number;
  radius?: number;
  fontSize?: number;
  selectable?: boolean;
  evented?: boolean;
}

export interface LineOptions extends Omit<ShapeOptions, 'width' | 'height' | 'radius'> {
  strokeWidth?: number;
}

export interface TextOptions extends ShapeOptions {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  textAlign?: string;
}

export interface ExportOptions {
  format?: 'png' | 'jpeg' | 'svg';
  quality?: number;
  multiplier?: number;
}

export interface CanvasContextValue {
  canvas: fabric.Canvas | null;
  isReady: boolean;
  initializeCanvas: (
    canvasElement: HTMLCanvasElement,
    options?: Partial<fabric.CanvasOptions>
  ) => fabric.Canvas;
  setShouldRecordHistory: (recordHistory: boolean) => void;
  getShouldRecordHistory: () => boolean;
  setInitialCanvas: (json: string) => void;
  getInitialCanvas: () => string;
  disposeCanvas: () => void;
  canvasRef: fabric.Canvas | null;
}

export interface ShapeCreators {
  addGlowingCircle: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  addCircleWithArrowOut: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  addArrowShape: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  presenceSensor: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  addParallelLines: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  addGlowingLine: (
    name: string,
    shapeId: number,
    setIsDrawingLine: (drawing: boolean) => void,
    options?: ShapeOptions,
    reason?: string
  ) => void;
  addGlowingRectangle: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  // addRectangle: (
  //   name: string,
  //   shapeId: number,
  //   options?: ShapeOptions,
  //   reason?: string
  // ) => fabric.Rect | undefined;
  addCircleX: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  addSconceVertica: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  addSconceDirectional: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  addSconceWash: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  addChandelier: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  addLetterDShape: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  addLetterSShape: (
    name: string,
    shapeId: number,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Group | undefined;
  addPolygon: (
    name: string,
    shapeId: number,
    setIsDrawingPolygon: React.Dispatch<React.SetStateAction<boolean>>,
    options?: ShapeOptions,
    reason?: string
  ) => fabric.Polygon | undefined;
  drawReferenceLine: (
    name: string,
    shapeId: number,
    setIsDrawingLine: React.Dispatch<React.SetStateAction<boolean>>,
    onLineLengthDialogOpen?: (length: number, line: fabric.Line) => void,
    reason?: string
  ) => void;
}

export interface CanvasOperations {
  selectAll: () => void;
  deleteSelected: () => void;
  zoomIn: (factor?: number) => void;
  zoomOut: (factor?: number) => void;
  resetZoom: () => void;
  clearCanvas: () => void;
  getCanvasSize: () => CanvasSize;
  updateShapeColor: (color: string) => void;
}

export interface HistoryOperations {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export interface CanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export interface ExtendedCanvas extends fabric.Canvas {
  isDragging?: boolean;
  lastPosX?: number;
  lastPosY?: number;
}
