import { create } from 'zustand'
import { ConnectionSlice, createConnectionSlice } from './slices/connectionSlice'
import { UiSlice, createUiSlice } from './slices/uiSlice'

export type RootStore = ConnectionSlice & UiSlice

export const useAppStore = create<RootStore>()((...a) => ({
  ...createConnectionSlice(...a),
  ...createUiSlice(...a),
}))
