import { StateCreator } from 'zustand';
import { ConnectionInfo, CollectionInfo } from '@shared/ipc-types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionSlice {
  connections: ConnectionInfo[];
  activeConnectionId: string | null;
  activeCollectionPath: string | null;
  connectionStatuses: Record<string, ConnectionStatus>;
  connectionErrors: Record<string, string | undefined>;
  collectionsByConnection: Record<string, CollectionInfo[]>;
  expandedConnectionIds: Record<string, boolean>;

  setConnections: (connections: ConnectionInfo[]) => void;
  addConnection: (connection: ConnectionInfo) => void;
  removeConnection: (id: string) => void;
  setActiveConnectionId: (id: string | null) => void;
  setActiveCollectionPath: (path: string | null) => void;
  setConnectionStatus: (id: string, status: ConnectionStatus, error?: string) => void;
  setCollections: (connectionId: string, collections: CollectionInfo[]) => void;
  toggleExpandConnection: (id: string) => void;
  setConnectionExpanded: (id: string, expanded: boolean) => void;
  updateConnectionReadOnly: (id: string, readOnly: boolean) => void;
}

export const createConnectionSlice: StateCreator<ConnectionSlice, [], [], ConnectionSlice> = (set) => ({
  connections: [],
  activeConnectionId: null,
  activeCollectionPath: null,
  connectionStatuses: {},
  connectionErrors: {},
  collectionsByConnection: {},
  expandedConnectionIds: {},

  setConnections: (connections) => set({ connections }),
  addConnection: (connection) =>
    set((state) => ({
      connections: [connection, ...state.connections.filter((c) => c.id !== connection.id)],
    })),
  removeConnection: (id) =>
    set((state) => {
      const nextStatuses = { ...state.connectionStatuses };
      const nextErrors = { ...state.connectionErrors };
      const nextCollections = { ...state.collectionsByConnection };
      const nextExpanded = { ...state.expandedConnectionIds };
      delete nextStatuses[id];
      delete nextErrors[id];
      delete nextCollections[id];
      delete nextExpanded[id];

      return {
        connections: state.connections.filter((c) => c.id !== id),
        activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
        activeCollectionPath: state.activeConnectionId === id ? null : state.activeCollectionPath,
        connectionStatuses: nextStatuses,
        connectionErrors: nextErrors,
        collectionsByConnection: nextCollections,
        expandedConnectionIds: nextExpanded,
      };
    }),
  setActiveConnectionId: (activeConnectionId) => set({ activeConnectionId }),
  setActiveCollectionPath: (activeCollectionPath) => set({ activeCollectionPath }),
  setConnectionStatus: (id, status, error) =>
    set((state) => ({
      connectionStatuses: { ...state.connectionStatuses, [id]: status },
      connectionErrors: { ...state.connectionErrors, [id]: error },
    })),
  setCollections: (connectionId, collections) =>
    set((state) => ({
      collectionsByConnection: { ...state.collectionsByConnection, [connectionId]: collections },
    })),
  toggleExpandConnection: (id) =>
    set((state) => ({
      expandedConnectionIds: {
        ...state.expandedConnectionIds,
        [id]: !state.expandedConnectionIds[id],
      },
    })),
  setConnectionExpanded: (id, expanded) =>
    set((state) => ({
      expandedConnectionIds: { ...state.expandedConnectionIds, [id]: expanded },
    })),
  updateConnectionReadOnly: (id, readOnly) =>
    set((state) => ({
      connections: state.connections.map((c) => (c.id === id ? { ...c, readOnly } : c)),
    })),
});
