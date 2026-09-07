import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS, AppApi, LiveUpdateEvent } from '@shared/ipc-types'

const api: AppApi = {
  // Connection
  addConnection: (req) => ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_ADD, req),
  removeConnection: (id) => ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_REMOVE, id),
  listConnections: () => ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_LIST),
  testConnection: (id) => ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_TEST, id),
  testRawConnection: (json) => ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_TEST_RAW, json),
  disconnectConnection: (id) => ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_DISCONNECT, id),
  updateReadOnly: (req) => ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_UPDATE_READONLY, req),

  // Google OAuth
  startGoogleOAuth: (req) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GOOGLE_START, req),

  // Collections & Subcollections
  listCollections: (req) => ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_LIST, req),
  listSubcollections: (req) => ipcRenderer.invoke(IPC_CHANNELS.SUBCOLLECTIONS_LIST, req),

  // Documents
  queryDocuments: (req) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_QUERY, req),
  getDocument: (req) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_GET, req),
  createDocument: (req) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_CREATE, req),
  updateDocument: (req) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_UPDATE, req),
  updateField: (req) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_UPDATE_FIELD, req),
  deleteDocument: (req) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_DELETE, req),
  batchDeleteDocs: (req) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_BATCH_DELETE, req),

  // Import / Export
  exportCollection: (req) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_COLLECTION, req),
  planImport: (req) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_PLAN, req),
  commitImport: (req) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_COMMIT, req),

  // Backup & Restore
  backupDatabase: (req) => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_DATABASE, req),
  inspectRestore: (req) => ipcRenderer.invoke(IPC_CHANNELS.RESTORE_INSPECT, req),
  commitRestore: (req) => ipcRenderer.invoke(IPC_CHANNELS.RESTORE_COMMIT, req),

  // Script Runner
  executeScript: (req) => ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_EXECUTE, req),

  // Live onSnapshot Mode
  subscribeLive: (req) => ipcRenderer.invoke(IPC_CHANNELS.LIVE_SUBSCRIBE, req),
  unsubscribeLive: (collectionPath) => ipcRenderer.invoke(IPC_CHANNELS.LIVE_UNSUBSCRIBE, collectionPath),
  onLiveUpdate: (callback: (event: LiveUpdateEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: LiveUpdateEvent) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.LIVE_UPDATE_EVENT, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.LIVE_UPDATE_EVENT, handler);
    };
  },

  // Saved Queries
  listSavedQueries: (collectionPath) => ipcRenderer.invoke(IPC_CHANNELS.QUERIES_LIST, collectionPath),
  saveQuery: (req) => ipcRenderer.invoke(IPC_CHANNELS.QUERIES_SAVE, req),
  deleteSavedQuery: (id) => ipcRenderer.invoke(IPC_CHANNELS.QUERIES_DELETE, id),

  // Dialog & System helpers
  openFileDialog: (options) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, options),
  saveFileDialog: (options) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, options),
  readTextFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_READ_FILE, filePath),
  openExternalUrl: (url) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, url),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
