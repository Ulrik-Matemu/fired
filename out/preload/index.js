"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const IPC_CHANNELS = {
  // Connections
  CONNECTION_ADD: "connection:add",
  CONNECTION_REMOVE: "connection:remove",
  CONNECTION_LIST: "connection:list",
  CONNECTION_TEST: "connection:test",
  CONNECTION_TEST_RAW: "connection:testRaw",
  CONNECTION_DISCONNECT: "connection:disconnect",
  CONNECTION_UPDATE_READONLY: "connection:updateReadOnly",
  // OAuth
  AUTH_GOOGLE_START: "auth:google:start",
  // Collections & Subcollections
  COLLECTIONS_LIST: "firestore:collections:list",
  SUBCOLLECTIONS_LIST: "firestore:subcollections:list",
  // Documents
  DOCUMENTS_QUERY: "firestore:documents:query",
  DOCUMENTS_GET: "firestore:documents:get",
  DOCUMENTS_CREATE: "firestore:documents:create",
  DOCUMENTS_UPDATE: "firestore:documents:update",
  DOCUMENTS_UPDATE_FIELD: "firestore:documents:updateField",
  DOCUMENTS_DELETE: "firestore:documents:delete",
  DOCUMENTS_BATCH_DELETE: "firestore:documents:batchDelete",
  // Import / Export
  EXPORT_COLLECTION: "firestore:export",
  IMPORT_PLAN: "firestore:import:plan",
  IMPORT_COMMIT: "firestore:import:commit",
  // Backup & Restore
  BACKUP_DATABASE: "firestore:backup",
  RESTORE_INSPECT: "firestore:restore:inspect",
  RESTORE_COMMIT: "firestore:restore:commit",
  // Script Runner
  SCRIPT_EXECUTE: "script:execute",
  // Real-time Live onSnapshot
  LIVE_SUBSCRIBE: "firestore:live:subscribe",
  LIVE_UNSUBSCRIBE: "firestore:live:unsubscribe",
  LIVE_UPDATE_EVENT: "firestore:live:update",
  // Saved Queries
  QUERIES_LIST: "queries:list",
  QUERIES_SAVE: "queries:save",
  QUERIES_DELETE: "queries:delete",
  // Dialogs & System
  DIALOG_OPEN_FILE: "dialog:openFile",
  DIALOG_SAVE_FILE: "dialog:saveFile",
  DIALOG_READ_FILE: "dialog:readFile",
  SYSTEM_OPEN_EXTERNAL: "system:openExternal"
};
const api = {
  // Connection
  addConnection: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_ADD, req),
  removeConnection: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_REMOVE, id),
  listConnections: () => electron.ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_LIST),
  testConnection: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_TEST, id),
  testRawConnection: (json) => electron.ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_TEST_RAW, json),
  disconnectConnection: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_DISCONNECT, id),
  updateReadOnly: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_UPDATE_READONLY, req),
  // Google OAuth
  startGoogleOAuth: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.AUTH_GOOGLE_START, req),
  // Collections & Subcollections
  listCollections: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_LIST, req),
  listSubcollections: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.SUBCOLLECTIONS_LIST, req),
  // Documents
  queryDocuments: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_QUERY, req),
  getDocument: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_GET, req),
  createDocument: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_CREATE, req),
  updateDocument: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_UPDATE, req),
  updateField: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_UPDATE_FIELD, req),
  deleteDocument: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_DELETE, req),
  batchDeleteDocs: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_BATCH_DELETE, req),
  // Import / Export
  exportCollection: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.EXPORT_COLLECTION, req),
  planImport: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.IMPORT_PLAN, req),
  commitImport: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.IMPORT_COMMIT, req),
  // Backup & Restore
  backupDatabase: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.BACKUP_DATABASE, req),
  inspectRestore: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.RESTORE_INSPECT, req),
  commitRestore: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.RESTORE_COMMIT, req),
  // Script Runner
  executeScript: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_EXECUTE, req),
  // Live onSnapshot Mode
  subscribeLive: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.LIVE_SUBSCRIBE, req),
  unsubscribeLive: (collectionPath) => electron.ipcRenderer.invoke(IPC_CHANNELS.LIVE_UNSUBSCRIBE, collectionPath),
  onLiveUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    electron.ipcRenderer.on(IPC_CHANNELS.LIVE_UPDATE_EVENT, handler);
    return () => {
      electron.ipcRenderer.removeListener(IPC_CHANNELS.LIVE_UPDATE_EVENT, handler);
    };
  },
  // Saved Queries
  listSavedQueries: (collectionPath) => electron.ipcRenderer.invoke(IPC_CHANNELS.QUERIES_LIST, collectionPath),
  saveQuery: (req) => electron.ipcRenderer.invoke(IPC_CHANNELS.QUERIES_SAVE, req),
  deleteSavedQuery: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.QUERIES_DELETE, id),
  // Dialog & System helpers
  openFileDialog: (options) => electron.ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, options),
  saveFileDialog: (options) => electron.ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, options),
  readTextFile: (filePath) => electron.ipcRenderer.invoke(IPC_CHANNELS.DIALOG_READ_FILE, filePath),
  openExternalUrl: (url) => electron.ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, url)
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
