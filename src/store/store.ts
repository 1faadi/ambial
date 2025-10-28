import { configureStore } from '@reduxjs/toolkit';
import fileReducer from '@/store/slices/fileSlice';
import canvasReducer from '@/store/slices/canvasSlice';

export const store = configureStore({
  reducer: {
    fileReducer,
    canvasReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
