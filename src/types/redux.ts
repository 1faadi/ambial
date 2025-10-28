export interface FileState {
  file: string | null;
  fileName: string;
}

export interface CanvasState {
  pixelToFeetRatio: number | null;
  shapeSizes: Record<number, number>; // shapeId -> size in pixels
}

export interface RootState {
  fileReducer: FileState;
  canvasReducer: CanvasState;
}
