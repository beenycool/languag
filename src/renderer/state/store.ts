// src/renderer/state/store.ts

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import editorReducer from './editor/reducer';
import analysisReducer from './analysis/reducer';

const rootReducer = combineReducers({
  editor: editorReducer,
  analysis: analysisReducer,
  // Add other reducers here as your app grows
});

export const store = configureStore({
  reducer: rootReducer,
  // Middleware can be added here, e.g., for async actions (thunks) or logging
  // middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(logger),
  devTools: process.env.NODE_ENV !== 'production', // Enable Redux DevTools in development
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {editor: EditorState, analysis: AnalysisState, ...}
export type AppDispatch = typeof store.dispatch;

// Export a hook that can be reused to resolve types
// import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
// export const useAppDispatch = () => useDispatch<AppDispatch>();
// export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;