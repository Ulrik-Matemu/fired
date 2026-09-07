import {
  AppApi,
  ConnectionInfo,
  CollectionInfo,
  QueryDocumentsRequest,
  QueryDocumentsResponse,
  ExportCollectionRequest,
  ScriptExecuteRequest,
  ScriptExecuteResponse,
  LiveSubscribeRequest,
  LiveUpdateEvent,
  SavedQuery,
  SaveQueryRequest,
  WhereClause,
} from '@shared/ipc-types';
import { SerializedDocument, SerializedFieldValue, SerializedTimestamp } from '@shared/firestore-types';
import {
  DEMO_CONNECTIONS,
  DEMO_COLLECTIONS,
  INITIAL_DOCUMENTS,
  DEMO_SAVED_QUERIES,
} from './mockData';

// Helper to extract primitive comparison value from SerializedFieldValue
function getPrimitiveValue(val: SerializedFieldValue | undefined | null): unknown {
  if (!val) return null;
  switch (val.__type) {
    case 'string':
    case 'number':
    case 'boolean':
      return val.value;
    case 'null':
      return null;
    case 'timestamp':
      return val.value.seconds;
    case 'geopoint':
      return val.value.latitude;
    case 'reference':
      return val.value.path;
    case 'bytes':
      return val.value;
    case 'array':
      return val.value.map(getPrimitiveValue);
    case 'map':
      return val.value;
    default:
      return null;
  }
}

// Deep clone helper
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function nowTimestamp(): SerializedTimestamp {
  const s = Math.floor(Date.now() / 1000);
  return {
    seconds: s,
    nanoseconds: 0,
    iso: new Date(s * 1000).toISOString(),
  };
}

export function createMockApi(): AppApi {
  // In-memory mutable state
  let connections: ConnectionInfo[] = deepClone(DEMO_CONNECTIONS);
  const collectionsByConnection: Record<string, CollectionInfo[]> = deepClone(DEMO_COLLECTIONS);
  let documentsByPath: Record<string, SerializedDocument[]> = deepClone(INITIAL_DOCUMENTS);
  let savedQueries: SavedQuery[] = deepClone(DEMO_SAVED_QUERIES);

  // Live subscription listeners
  const liveListeners: Set<(event: LiveUpdateEvent) => void> = new Set();
  let liveInterval: NodeJS.Timeout | null = null;

  return {
    // ── Connections ──
    addConnection: async (req) => {
      const newConn: ConnectionInfo = {
        id: `demo-conn-${Date.now()}`,
        name: req.name || 'Demo Firebase Project',
        projectId: 'custom-demo-project',
        clientEmail: 'demo-user@custom-demo-project.iam.gserviceaccount.com',
        createdAt: Date.now(),
        authType: 'serviceAccount',
        readOnly: false,
      };
      connections.push(newConn);
      collectionsByConnection[newConn.id] = [
        { id: 'users', path: 'users' },
        { id: 'orders', path: 'orders' },
      ];
      return deepClone(newConn);
    },

    removeConnection: async (id) => {
      connections = connections.filter((c) => c.id !== id);
      delete collectionsByConnection[id];
      return true;
    },

    listConnections: async () => {
      return deepClone(connections);
    },

    testConnection: async () => {
      return { success: true, projectId: 'demo-project', clientEmail: 'demo@firestore.local' };
    },

    testRawConnection: async () => {
      return { success: true, projectId: 'demo-project', clientEmail: 'demo@firestore.local' };
    },

    disconnectConnection: async () => {
      // No-op in demo
    },

    updateReadOnly: async ({ connectionId, readOnly }) => {
      const conn = connections.find((c) => c.id === connectionId);
      if (conn) {
        conn.readOnly = readOnly;
      }
      return true;
    },

    startGoogleOAuth: async (req) => {
      const newConn: ConnectionInfo = {
        id: `demo-oauth-${Date.now()}`,
        name: req.name || req.projectId || 'Google OAuth Demo',
        projectId: req.projectId || 'oauth-demo-project',
        clientEmail: 'demo-google-user@gmail.com',
        createdAt: Date.now(),
        authType: 'oauth',
        readOnly: false,
      };
      connections.push(newConn);
      collectionsByConnection[newConn.id] = [
        { id: 'tenants', path: 'tenants' },
        { id: 'subscriptions', path: 'subscriptions' },
      ];
      return deepClone(newConn);
    },

    // ── Collections & Subcollections ──
    listCollections: async ({ connectionId, parentPath }) => {
      if (parentPath) {
        // Look for subcollections matching parentPath
        const subcols: CollectionInfo[] = [];
        const prefix = `${parentPath}/`;
        for (const colPath of Object.keys(documentsByPath)) {
          if (colPath.startsWith(prefix) && !colPath.slice(prefix.length).includes('/')) {
            const parts = colPath.split('/');
            subcols.push({ id: parts[parts.length - 1], path: colPath });
          }
        }
        return subcols;
      }

      return deepClone(collectionsByConnection[connectionId] || []);
    },

    listSubcollections: async ({ documentPath }) => {
      const subcols: string[] = [];
      const prefix = `${documentPath}/`;
      for (const colPath of Object.keys(documentsByPath)) {
        if (colPath.startsWith(prefix) && !colPath.slice(prefix.length).includes('/')) {
          const parts = colPath.split('/');
          subcols.push(parts[parts.length - 1]);
        }
      }
      return subcols;
    },

    // ── Documents ──
    queryDocuments: async (req: QueryDocumentsRequest): Promise<QueryDocumentsResponse> => {
      let docs = documentsByPath[req.collectionPath] || [];
      docs = deepClone(docs);

      // 1. Where Filtering
      if (req.where && req.where.length > 0) {
        docs = docs.filter((doc) => {
          return req.where!.every((w: WhereClause) => {
            const docVal = doc.fields[w.field];
            const targetVal = getPrimitiveValue(w.value);
            const actualVal = getPrimitiveValue(docVal);

            switch (w.operator) {
              case '==':
                return actualVal === targetVal;
              case '!=':
                return actualVal !== targetVal;
              case '<':
                return (actualVal as number) < (targetVal as number);
              case '<=':
                return (actualVal as number) <= (targetVal as number);
              case '>':
                return (actualVal as number) > (targetVal as number);
              case '>=':
                return (actualVal as number) >= (targetVal as number);
              case 'array-contains':
                return Array.isArray(actualVal) && actualVal.includes(targetVal);
              case 'in':
                return Array.isArray(targetVal) && targetVal.includes(actualVal);
              case 'not-in':
                return Array.isArray(targetVal) && !targetVal.includes(actualVal);
              default:
                return true;
            }
          });
        });
      }

      // 2. OrderBy Sorting
      if (req.orderBy && req.orderBy.length > 0) {
        docs.sort((a, b) => {
          for (const order of req.orderBy!) {
            const valA = getPrimitiveValue(a.fields[order.field]);
            const valB = getPrimitiveValue(b.fields[order.field]);

            if (valA === valB) continue;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            const cmp = (valA as any) > (valB as any) ? 1 : -1;
            return order.direction === 'asc' ? cmp : -cmp;
          }
          return 0;
        });
      }

      // 3. Cursor Pagination
      let startIndex = 0;
      if (req.startAfterCursor && req.startAfterCursor.length > 0) {
        const afterIdVal = req.startAfterCursor[0];
        if (afterIdVal && afterIdVal.__type === 'string') {
          const found = docs.findIndex((d) => d.__id === afterIdVal.value);
          if (found !== -1) {
            startIndex = found + 1;
          }
        }
      }

      const limit = req.limit || 50;
      const paginated = docs.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < docs.length;

      const nextCursor = hasMore && paginated.length > 0
        ? [{ __type: 'string' as const, value: paginated[paginated.length - 1].__id }]
        : null;

      return {
        documents: paginated,
        nextCursor,
        totalCount: docs.length,
      };
    },

    getDocument: async ({ documentPath }) => {
      const lastSlash = documentPath.lastIndexOf('/');
      if (lastSlash === -1) return null;
      const col = documentPath.slice(0, lastSlash);
      const id = documentPath.slice(lastSlash + 1);
      const doc = (documentsByPath[col] || []).find((d) => d.__id === id);
      return doc ? deepClone(doc) : null;
    },

    createDocument: async ({ connectionId, collectionPath, documentId, data }) => {
      const conn = connections.find((c) => c.id === connectionId);
      if (conn?.readOnly) {
        throw new Error('Permission denied: Connection is in read-only mode.');
      }

      const newId = documentId || `doc_${Date.now()}`;
      const now = nowTimestamp();
      const newDoc: SerializedDocument = {
        __id: newId,
        __path: `${collectionPath}/${newId}`,
        __createTime: now,
        __updateTime: now,
        fields: deepClone(data),
      };

      if (!documentsByPath[collectionPath]) {
        documentsByPath[collectionPath] = [];
      }
      documentsByPath[collectionPath].unshift(newDoc);
      return deepClone(newDoc);
    },

    updateDocument: async ({ connectionId, documentPath, data, merge }) => {
      const conn = connections.find((c) => c.id === connectionId);
      if (conn?.readOnly) {
        throw new Error('Permission denied: Connection is in read-only mode.');
      }

      const lastSlash = documentPath.lastIndexOf('/');
      const col = documentPath.slice(0, lastSlash);
      const id = documentPath.slice(lastSlash + 1);
      const list = documentsByPath[col] || [];
      const doc = list.find((d) => d.__id === id);

      if (doc) {
        doc.fields = merge ? { ...doc.fields, ...deepClone(data) } : deepClone(data);
        doc.__updateTime = nowTimestamp();
      }
    },

    updateField: async ({ connectionId, documentPath, fieldPath, value }) => {
      const conn = connections.find((c) => c.id === connectionId);
      if (conn?.readOnly) {
        throw new Error('Permission denied: Connection is in read-only mode.');
      }

      const lastSlash = documentPath.lastIndexOf('/');
      const col = documentPath.slice(0, lastSlash);
      const id = documentPath.slice(lastSlash + 1);
      const list = documentsByPath[col] || [];
      const doc = list.find((d) => d.__id === id);

      if (!doc) throw new Error(`Document ${documentPath} not found.`);

      // Support nested dot path
      const parts = fieldPath.split('.');
      if (parts.length === 1) {
        doc.fields[fieldPath] = deepClone(value);
      } else {
        let current: any = doc.fields;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) current[parts[i]] = { __type: 'map', value: {} };
          current = current[parts[i]].value;
        }
        current[parts[parts.length - 1]] = deepClone(value);
      }
      doc.__updateTime = nowTimestamp();

      return deepClone(doc);
    },

    deleteDocument: async ({ connectionId, documentPath }) => {
      const conn = connections.find((c) => c.id === connectionId);
      if (conn?.readOnly) {
        throw new Error('Permission denied: Connection is in read-only mode.');
      }

      const lastSlash = documentPath.lastIndexOf('/');
      const col = documentPath.slice(0, lastSlash);
      const id = documentPath.slice(lastSlash + 1);
      if (documentsByPath[col]) {
        documentsByPath[col] = documentsByPath[col].filter((d) => d.__id !== id);
      }
    },

    batchDeleteDocs: async ({ connectionId, documentPaths }) => {
      const conn = connections.find((c) => c.id === connectionId);
      if (conn?.readOnly) {
        throw new Error('Permission denied: Connection is in read-only mode.');
      }

      let deleted = 0;
      for (const path of documentPaths) {
        const lastSlash = path.lastIndexOf('/');
        const col = path.slice(0, lastSlash);
        const id = path.slice(lastSlash + 1);
        if (documentsByPath[col]) {
          const before = documentsByPath[col].length;
          documentsByPath[col] = documentsByPath[col].filter((d) => d.__id !== id);
          deleted += before - documentsByPath[col].length;
        }
      }

      return { deleted, batchCount: 1 };
    },

    // ── Export / Import ──
    exportCollection: async (req: ExportCollectionRequest) => {
      const docs = req.currentDocuments || documentsByPath[req.collectionPath] || [];
      const content = req.format === 'json'
        ? JSON.stringify(docs, null, 2)
        : 'id,data\n' + docs.map((d) => `${d.__id},"${JSON.stringify(d.fields)}"`).join('\n');

      // Trigger browser download if running in web
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([content], { type: req.format === 'json' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = req.filePath || `${req.collectionPath}-export.${req.format}`;
        a.click();
        URL.revokeObjectURL(url);
      }

      return { success: true, count: docs.length };
    },

    planImport: async () => {
      return {
        success: true,
        totalIncoming: 2,
        newCount: 2,
        conflictCount: 0,
        conflicts: [],
        schemaWarnings: [],
        newDocuments: [
          {
            documentId: 'import_sample_1',
            fields: {
              name: { __type: 'string', value: 'Imported Customer' },
              score: { __type: 'number', value: 95 },
            },
          },
        ],
        sourceFormat: 'json',
      };
    },

    commitImport: async ({ connectionId, collectionPath, newDocuments }) => {
      const conn = connections.find((c) => c.id === connectionId);
      if (conn?.readOnly) {
        throw new Error('Permission denied: Connection is in read-only mode.');
      }

      if (!documentsByPath[collectionPath]) {
        documentsByPath[collectionPath] = [];
      }

      const now = nowTimestamp();
      for (const doc of newDocuments) {
        documentsByPath[collectionPath].unshift({
          __id: doc.documentId,
          __path: `${collectionPath}/${doc.documentId}`,
          __createTime: now,
          __updateTime: now,
          fields: deepClone(doc.fields),
        });
      }

      return { success: true, committed: newDocuments.length, skipped: 0, batchCount: 1 };
    },

    // ── Backup & Restore ──
    backupDatabase: async (req) => {
      const archive = {
        format: 'fired-backup-v1',
        version: 1,
        timestamp: Date.now(),
        projectId: 'demo-ecommerce-prod',
        collections: deepClone(documentsByPath),
      };

      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = req.filePath || 'fired-demo-backup.fired-backup';
        a.click();
        URL.revokeObjectURL(url);
      }

      let totalDocs = 0;
      for (const list of Object.values(documentsByPath)) totalDocs += list.length;

      return {
        success: true,
        totalCollections: Object.keys(documentsByPath).length,
        totalDocuments: totalDocs,
        filePath: req.filePath,
      };
    },

    inspectRestore: async () => {
      let totalDocs = 0;
      const cols = Object.keys(documentsByPath).map((c) => {
        const count = documentsByPath[c].length;
        totalDocs += count;
        return { name: c, docCount: count };
      });

      return {
        success: true,
        projectId: 'demo-archive',
        timestamp: Date.now(),
        collections: cols,
        totalDocuments: totalDocs,
      };
    },

    commitRestore: async ({ connectionId }) => {
      const conn = connections.find((c) => c.id === connectionId);
      if (conn?.readOnly) {
        throw new Error('Permission denied: Connection is in read-only mode.');
      }
      return { success: true, committed: 10, skipped: 0, batchCount: 1 };
    },

    // ── Script Runner ──
    executeScript: async (req: ScriptExecuteRequest): Promise<ScriptExecuteResponse> => {
      const logs: string[] = [];
      const startTime = Date.now();

      const conn = connections.find((c) => c.id === req.connectionId);
      if (conn?.readOnly) {
        return {
          success: false,
          logs: ['[Security] Script execution blocked: Connection is in READ-ONLY mode.'],
          error: 'Permission denied: Connection is in read-only mode.',
          durationMs: 0,
        };
      }

      try {
        const targetCol = req.collectionPath || 'users';
        const currentDocs = documentsByPath[targetCol] || [];

        // Mock collection object
        const mockCollection = {
          get: async () => ({
            size: currentDocs.length,
            docs: currentDocs.map((d) => ({
              id: d.__id,
              data: () => deepClone(d.fields),
              ref: { id: d.__id },
            })),
          }),
          limit: (n: number) => ({
            get: async () => ({
              size: Math.min(n, currentDocs.length),
              docs: currentDocs.slice(0, n).map((d) => ({
                id: d.__id,
                data: () => deepClone(d.fields),
                ref: { id: d.__id },
              })),
            }),
          }),
        };

        const mockDb = {
          collection: () => mockCollection,
          batch: () => ({
            update: () => {},
            commit: async () => {},
          }),
        };

        const mockConsole = {
          log: (...args: any[]) => logs.push(args.map(String).join(' ')),
          info: (...args: any[]) => logs.push('[INFO] ' + args.map(String).join(' ')),
          warn: (...args: any[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
          error: (...args: any[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
        };

        // Create async runner function with injected context
        const fn = new Function('db', 'collection', 'console', `return (async () => {\n${req.script}\n})()`);
        const result = await fn(mockDb, mockCollection, mockConsole);

        return {
          success: true,
          logs,
          result: result !== undefined ? deepClone(result) : undefined,
          durationMs: Date.now() - startTime,
        };
      } catch (err) {
        return {
          success: false,
          logs: [...logs, `[Runtime Error] ${(err as Error).message}`],
          error: (err as Error).message,
          durationMs: Date.now() - startTime,
        };
      }
    },

    // ── Live Mode ──
    subscribeLive: async (req: LiveSubscribeRequest) => {
      // Simulate periodic live updates every 5 seconds
      if (liveInterval) clearInterval(liveInterval);
      liveInterval = setInterval(() => {
        const docs = documentsByPath[req.collectionPath] || [];
        for (const listener of liveListeners) {
          listener({
            connectionId: req.connectionId,
            collectionPath: req.collectionPath,
            documents: deepClone(docs),
          });
        }
      }, 5000);
      return true;
    },

    unsubscribeLive: async () => {
      if (liveInterval) {
        clearInterval(liveInterval);
        liveInterval = null;
      }
      return true;
    },

    onLiveUpdate: (callback) => {
      liveListeners.add(callback);
      return () => {
        liveListeners.delete(callback);
      };
    },

    // ── Saved Queries ──
    listSavedQueries: async (collectionPath) => {
      if (collectionPath) {
        return deepClone(savedQueries.filter((q) => !q.collectionPath || q.collectionPath === collectionPath));
      }
      return deepClone(savedQueries);
    },

    saveQuery: async (req: SaveQueryRequest) => {
      const q: SavedQuery = {
        id: `query-${Date.now()}`,
        name: req.name,
        collectionPath: req.collectionPath,
        connectionId: req.connectionId,
        where: deepClone(req.where),
        orderBy: deepClone(req.orderBy),
        createdAt: Date.now(),
      };
      savedQueries.unshift(q);
      return deepClone(q);
    },

    deleteSavedQuery: async (id) => {
      savedQueries = savedQueries.filter((q) => q.id !== id);
      return true;
    },

    // ── Dialogs & System Helpers ──
    openFileDialog: async () => {
      return 'demo-sample-file.fired-backup';
    },

    saveFileDialog: async (options) => {
      return options?.defaultPath || 'export.json';
    },

    readTextFile: async () => {
      return JSON.stringify(documentsByPath['users'] || []);
    },

    openExternalUrl: async (url) => {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    },
  };
}
