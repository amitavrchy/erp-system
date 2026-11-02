import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Me } from '@/lib/types';

const auth = createSlice({ name: 'auth', initialState: { user: null as Me|null, ready: false }, reducers: { session(state, action: PayloadAction<Me|null>) { state.user = action.payload; state.ready = true; } } });
const ui = createSlice({ name: 'ui', initialState: { theme: 'dark', density: 'comfortable', collapsed: false }, reducers: {
  preferences(state, action: PayloadAction<Partial<{theme: string; density: string; collapsed: boolean}>>) { Object.assign(state, action.payload); },
} });
const org = createSlice({ name: 'org', initialState: { activeOrgId: '' }, reducers: { activeOrg(state, action: PayloadAction<string>) { state.activeOrgId = action.payload; } } });
export const { session } = auth.actions;
export const { preferences } = ui.actions;
export const { activeOrg } = org.actions;
export const makeStore = () => configureStore({ reducer: { auth: auth.reducer, ui: ui.reducer, org: org.reducer } });
export type Store = ReturnType<typeof makeStore>;
export type RootState = ReturnType<Store['getState']>;
export type Dispatch = Store['dispatch'];
