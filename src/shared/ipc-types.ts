import { SerializedDocument, SerializedFieldValue, SerializedCursorValues } from './firestore-types';

export const IPC_CHANNELS = {
  // Connections
  CONNECTION_ADD: 'connection:add',
  CONNECTION_REMOVE: 'connection:remove',
  CONNECTION_LIST: 'connection:list',
  CONNECTION_TEST: 'connection:test',
  CONNECTION_TEST_RAW: 'connection:testRaw',
  CONNECTION_DISCONNECT: 'connection:disconnect',
  CONNECTION_UPDATE_READONLY: 'connection:updateReadOnly',

  // OAuth
  AUTH_GOOGLE_START: 'auth:google:start',

  // Collections & Subcollections
  COLLECTIONS_LIST: 'firestore:collections:list',
  COLLECTIONS_LIST_SUB: 'firestore:collections:listSub',
  SUBCOLLECTIONS_LIST: 'firestore:subcollections:list',

  // Documents
  DOCUMENTS_QUERY: 'firestore:documents:query',
  DOCUMENTS_GET: 'firestore:documents:get',
  DOCUMENTS_CREATE: 'firestore:documents:create',
  DOCUMENTS_UPDATE: 'firestore:documents:update',
  DOCUMENTS_UPDATE_FIELD: 'firestore:documents:updateField',
  DOCUMENTS_DELETE: 'firestore:documents:delete',
  DOCUMENTS_BATCH_DELETE: 'firestore:documents:batchDelete',

  // Import / Export
  EXPORT_COLLECTION: 'firestore:export',
  IMPORT_PLAN: 'firestore:import:plan',
  IMPORT_COMMIT: 'firestore:import:commit',

  // Backup & Restore
  BACKUP_DATABASE: 'firestore:backup',
  RESTORE_INSPECT: 'firestore:restore:inspect',
  RESTORE_COMMIT: 'firestore:restore:commit',

  // Script Runner
  SCRIPT_EXECUTE: 'script:execute',

  // Real-time Live onSnapshot
  LIVE_SUBSCRIBE: 'firestore:live:subscribe',
  LIVE_UNSUBSCRIBE: 'firestore:live:unsubscribe',
  LIVE_UPDATE_EVENT: 'firestore:live:update',

  // Saved Queries
  QUERIES_LIST: 'queries:list',
  QUERIES_SAVE: 'queries:save',
  QUERIES_DELETE: 'queries:delete',

  // Dialogs & System
  DIALOG_OPEN_FILE: 'dialog:openFile',
  DIALOG_SAVE_FILE: 'dialog:saveFile',
  DIALOG_READ_FILE: 'dialog:readFile',
  SYSTEM_OPEN_EXTERNAL: 'system:openExternal',
} as const;

// ── Connection DTOs ──

export interface ConnectionError {
  type: 'auth' | 'network' | 'unknown';
  message: string;
}

export interface AddConnectionRequest {
  name: string;
  serviceAccountJson: string;
}

export interface ConnectionInfo {
  id: string;
  name: string;
  projectId: string;
  clientEmail: string;
  createdAt: number;
  authType?: 'serviceAccount' | 'oauth';
  readOnly?: boolean;
}

export interface UpdateReadOnlyRequest {
  connectionId: string;
  readOnly: boolean;
}

export interface StartGoogleOAuthRequest {
  name: string;
  projectId: string;
  clientId?: string;
  clientSecret?: string;
}

export interface TestConnectionResult {
  success: boolean;
  projectId?: string;
  clientEmail?: string;
  error?: ConnectionError;
}

// ── Collection DTOs ──

export interface ListCollectionsRequest {
  connectionId: string;
  parentPath?: string;
}

export interface ListSubcollectionsRequest {
  connectionId: string;
  documentPath: string;
}

export interface CollectionInfo {
  id: string;
  path: string;
}

// ── Document Query DTOs ──

export type WhereOperator =
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'array-contains'
  | 'in'
  | 'array-contains-any'
  | 'not-in';

export interface WhereClause {
  field: string;
  operator: WhereOperator;
  value: SerializedFieldValue;
}

export interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryDocumentsRequest {
  connectionId: string;
  collectionPath: string;
  where?: WhereClause[];
  orderBy?: OrderByClause[];
  limit: number;
  startAfterCursor?: SerializedCursorValues;
}

export interface QueryDocumentsResponse {
  documents: SerializedDocument[];
  nextCursor: SerializedCursorValues | null;
  totalCount?: number;
  isIndexError?: boolean;
  indexUrl?: string;
  errorMessage?: string;
}

export interface GetDocumentRequest {
  connectionId: string;
  documentPath: string;
}

export interface CreateDocumentRequest {
  connectionId: string;
  collectionPath: string;
  documentId?: string;
  data: Record<string, SerializedFieldValue>;
}

export interface UpdateDocumentRequest {
  connectionId: string;
  documentPath: string;
  data: Record<string, SerializedFieldValue>;
  merge?: boolean;
}

export interface UpdateFieldRequest {
  connectionId: string;
  documentPath: string;
  fieldPath: string;
  value: SerializedFieldValue;
}

export interface DeleteDocumentRequest {
  connectionId: string;
  documentPath: string;
  recursive?: boolean;
}

export interface BatchDeleteDocumentsRequest {
  connectionId: string;
  documentPaths: string[];
}

export interface BatchDeleteDocumentsResponse {
  deleted: number;
  batchCount: number;
}

// ── Import / Export DTOs ──

export interface ExportCollectionRequest {
  connectionId: string;
  collectionPath: string;
  filePath: string;
  format: 'json' | 'csv';
  scope: 'current' | 'all';
  currentDocuments?: SerializedDocument[];
  where?: WhereClause[];
  orderBy?: OrderByClause[];
}

export interface ImportExportResult {
  success: boolean;
  count: number;
  error?: string;
}

export interface ImportConflict {
  documentId: string;
  documentPath: string;
  existingFields: Record<string, SerializedFieldValue>;
  incomingFields: Record<string, SerializedFieldValue>;
}

export interface SchemaWarning {
  documentId: string;
  field: string;
  expectedType: string;
  incomingType: string;
  message: string;
}

export interface ParsedImportDoc {
  documentId: string;
  fields: Record<string, SerializedFieldValue>;
}

export interface ImportPlanRequest {
  connectionId: string;
  collectionPath: string;
  filePath: string;
}

export interface ImportPlanResponse {
  success: boolean;
  error?: string;
  totalIncoming: number;
  newCount: number;
  conflictCount: number;
  conflicts: ImportConflict[];
  schemaWarnings: SchemaWarning[];
  newDocuments: ParsedImportDoc[];
  sourceFormat: 'json' | 'csv';
}

export interface ResolvedConflictItem {
  documentId: string;
  action: 'overwrite' | 'skip';
  fields: Record<string, SerializedFieldValue>;
}

export interface ImportCommitRequest {
  connectionId: string;
  collectionPath: string;
  newDocuments: ParsedImportDoc[];
  resolvedConflicts: ResolvedConflictItem[];
}

export interface ImportCommitResponse {
  success: boolean;
  committed: number;
  skipped: number;
  batchCount: number;
  error?: string;
}

// ── Multi-Collection Backup & Restore DTOs ──

export interface BackupDatabaseRequest {
  connectionId: string;
  collectionPaths?: string[];
  filePath: string;
}

export interface BackupDatabaseResponse {
  success: boolean;
  totalCollections: number;
  totalDocuments: number;
  filePath: string;
  error?: string;
}

export interface RestoreInspectRequest {
  filePath: string;
}

export interface RestoreInspectResponse {
  success: boolean;
  projectId: string;
  timestamp: number;
  collections: { name: string; docCount: number }[];
  totalDocuments: number;
  error?: string;
}

export interface RestoreCommitRequest {
  connectionId: string;
  filePath: string;
  strategy: 'overwrite' | 'skip';
  selectedCollections?: string[];
}

export interface RestoreCommitResponse {
  success: boolean;
  committed: number;
  skipped: number;
  batchCount: number;
  error?: string;
}

// ── Script Runner DTOs ──

export interface ScriptExecuteRequest {
  connectionId: string;
  collectionPath?: string;
  script: string;
}

export interface ScriptExecuteResponse {
  success: boolean;
  logs: string[];
  result?: unknown;
  error?: string;
  durationMs: number;
}

// ── Live onSnapshot DTOs ──

export interface LiveSubscribeRequest {
  connectionId: string;
  collectionPath: string;
  limit?: number;
  where?: WhereClause[];
  orderBy?: OrderByClause[];
}

export interface LiveUpdateEvent {
  connectionId: string;
  collectionPath: string;
  documents: SerializedDocument[];
}

// ── Saved Queries DTOs ──

export interface SavedQuery {
  id: string;
  name: string;
  connectionId?: string;
  collectionPath?: string;
  where: WhereClause[];
  orderBy: OrderByClause[];
  createdAt: number;
}

export interface SaveQueryRequest {
  name: string;
  connectionId?: string;
  collectionPath?: string;
  where: WhereClause[];
  orderBy: OrderByClause[];
}

// ── Client Exposed API Interface ──

export interface AppApi {
  // Connection
  addConnection: (req: AddConnectionRequest) => Promise<ConnectionInfo>;
  removeConnection: (id: string) => Promise<boolean>;
  listConnections: () => Promise<ConnectionInfo[]>;
  testConnection: (id: string) => Promise<TestConnectionResult>;
  testRawConnection: (serviceAccountJson: string) => Promise<TestConnectionResult>;
  disconnectConnection: (id: string) => Promise<void>;
  updateReadOnly: (req: UpdateReadOnlyRequest) => Promise<boolean>;

  // Google OAuth
  startGoogleOAuth: (req: StartGoogleOAuthRequest) => Promise<ConnectionInfo>;

  // Collections & Subcollections
  listCollections: (req: ListCollectionsRequest) => Promise<CollectionInfo[]>;
  listSubcollections: (req: ListSubcollectionsRequest) => Promise<string[]>;

  // Documents
  queryDocuments: (req: QueryDocumentsRequest) => Promise<QueryDocumentsResponse>;
  getDocument: (req: GetDocumentRequest) => Promise<SerializedDocument | null>;
  createDocument: (req: CreateDocumentRequest) => Promise<SerializedDocument>;
  updateDocument: (req: UpdateDocumentRequest) => Promise<void>;
  updateField: (req: UpdateFieldRequest) => Promise<SerializedDocument>;
  deleteDocument: (req: DeleteDocumentRequest) => Promise<void>;
  batchDeleteDocs: (req: BatchDeleteDocumentsRequest) => Promise<BatchDeleteDocumentsResponse>;

  // Import / Export
  exportCollection: (req: ExportCollectionRequest) => Promise<ImportExportResult>;
  planImport: (req: ImportPlanRequest) => Promise<ImportPlanResponse>;
  commitImport: (req: ImportCommitRequest) => Promise<ImportCommitResponse>;

  // Backup & Restore
  backupDatabase: (req: BackupDatabaseRequest) => Promise<BackupDatabaseResponse>;
  inspectRestore: (req: RestoreInspectRequest) => Promise<RestoreInspectResponse>;
  commitRestore: (req: RestoreCommitRequest) => Promise<RestoreCommitResponse>;

  // Script Runner
  executeScript: (req: ScriptExecuteRequest) => Promise<ScriptExecuteResponse>;

  // Live onSnapshot Mode
  subscribeLive: (req: LiveSubscribeRequest) => Promise<boolean>;
  unsubscribeLive: (collectionPath: string) => Promise<boolean>;
  onLiveUpdate: (callback: (event: LiveUpdateEvent) => void) => () => void;

  // Saved Queries
  listSavedQueries: (collectionPath?: string) => Promise<SavedQuery[]>;
  saveQuery: (req: SaveQueryRequest) => Promise<SavedQuery>;
  deleteSavedQuery: (id: string) => Promise<boolean>;

  // Dialog & System helpers
  openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  saveFileDialog: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  readTextFile: (filePath: string) => Promise<string>;
  openExternalUrl: (url: string) => Promise<void>;
}
