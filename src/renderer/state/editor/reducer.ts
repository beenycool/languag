// src/renderer/state/editor/reducer.ts

import {
  EditorReduxState,
  EditorActionTypes,
  SET_FILE_PATH,
  SET_CONTENT,
  SET_LANGUAGE,
  SET_SELECTION,
  SET_DIRTY_STATUS,
} from './types';

const initialState: EditorReduxState = {
  filePath: null,
  currentContent: '',
  language: 'plaintext',
  isDirty: false,
  selection: null,
};

const editorReducer = (
  state = initialState,
  action: EditorActionTypes
): EditorReduxState => {
  switch (action.type) {
    case SET_FILE_PATH:
      return {
        ...state,
        filePath: action.payload,
        isDirty: false, // Typically, loading a new file resets dirty status
        currentContent: action.payload ? state.currentContent : '', // Clear content if path is null
      };
    case SET_CONTENT:
      return {
        ...state,
        currentContent: action.payload.content,
        isDirty: action.payload.isDirty !== undefined ? action.payload.isDirty : state.isDirty,
      };
    case SET_LANGUAGE:
      return {
        ...state,
        language: action.payload,
      };
    case SET_SELECTION:
      return {
        ...state,
        selection: action.payload,
      };
    case SET_DIRTY_STATUS:
      return {
        ...state,
        isDirty: action.payload,
      };
    default:
      return state;
  }
};

export default editorReducer;