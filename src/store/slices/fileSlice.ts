import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { FileState } from '@/types/redux';

const initialState: FileState = {
  file: null,
  fileName: '',
};

const fileSlice = createSlice({
  name: 'file',
  initialState,
  reducers: {
    setFile: (state, action: PayloadAction<string | null>) => {
      state.file = action.payload;
    },
    setFileName: (state, action: PayloadAction<string>) => {
      state.fileName = action.payload;
    },
    setFileState: (state, action: PayloadAction<FileState>) => {
      return {
        ...state,
        ...action.payload,
      };
    },
  },
});

export const { setFile, setFileState, setFileName } = fileSlice.actions;
export default fileSlice.reducer;
