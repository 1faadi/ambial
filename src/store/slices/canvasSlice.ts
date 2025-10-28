import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CanvasState {
  pixelToFeetRatio: number | null;
  shapeSizes: Record<number, number>; // shapeId -> size in pixels
}

const initialState: CanvasState = {
  pixelToFeetRatio: null,
  shapeSizes: {},
};

const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    setPixelToFeetRatio: (state, action: PayloadAction<number>) => {
      state.pixelToFeetRatio = action.payload;
    },
    clearPixelToFeetRatio: state => {
      state.pixelToFeetRatio = null;
    },
    setShapeSize: (state, action: PayloadAction<{ shapeId: number; size: number }>) => {
      state.shapeSizes[action.payload.shapeId] = action.payload.size;
    },
    clearShapeSizes: state => {
      state.shapeSizes = {};
    },
  },
});

export const { setPixelToFeetRatio, clearPixelToFeetRatio, setShapeSize, clearShapeSizes } =
  canvasSlice.actions;
export default canvasSlice.reducer;
