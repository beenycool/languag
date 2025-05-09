// src/renderer/state/editor/actions.ts

import * as monaco from 'monaco-editor';
import {
  SET_FILE_PATH,
  SET_CONTENT,
  SET_LANGUAGE,
  SET_SELECTION,
  SET_DIRTY_STATUS,
  EditorActionTypes,
} from './types';

export const setFilePath = (filePath: string | null): EditorActionTypes => ({
  type: SET_FILE_PATH,
  payload: filePath,
});

export const setContent = (content: string, isDirty: boolean = true): EditorActionTypes => ({
  type: SET_CONTENT,
  payload: { content, isDirty },
});

export const setLanguage = (language: string): EditorActionTypes => ({
  type: SET_LANGUAGE,
  payload: language,
});

export const setSelection = (selection: monaco.Selection | null): EditorActionTypes => ({
  type: SET_SELECTION,
  payload: selection,
});

export const setDirtyStatus = (isDirty: boolean): EditorActionTypes => ({
  type: SET_DIRTY_STATUS,
  payload: isDirty,
});

// Example of a thunk action if you need async logic or access to getState
// import { AppThunk } from '../store'; // Assuming AppThunk type is defined in store.ts
//
// export const loadFileContent = (filePath: string): AppThunk => async (dispatch) => {
//   try {
//     // const content = await someFileReadingApi(filePath); // Replace with actual file reading
//     // dispatch(setFilePath(filePath));
//     // dispatch(setContent(content, false)); // Content from file is not "dirty" initially
//   } catch (error) {
//     console.error("Failed to load file content:", error);
//     // dispatch(someErrorAction(error));
//   }
// };