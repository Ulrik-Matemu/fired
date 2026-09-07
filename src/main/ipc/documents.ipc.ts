import { ipcMain } from 'electron';
import { FieldPath } from 'firebase-admin/firestore';
import {
  IPC_CHANNELS,
  QueryDocumentsRequest,
  QueryDocumentsResponse,
  GetDocumentRequest,
  UpdateFieldRequest,
  CreateDocumentRequest,
  DeleteDocumentRequest,
  BatchDeleteDocumentsRequest,
  BatchDeleteDocumentsResponse,
} from '@shared/ipc-types';
import { SerializedDocument, SerializedCursorValues } from '@shared/firestore-types';
import { connectionManager } from '../firebase/connectionManager';
import { credentialStore } from '../storage/credentialStore';
import { serializeDocument, deserializeField, serializeFieldValue } from '../firebase/serializer';

export function registerDocumentsIpc(): void {
  // Query documents with compound filters, ordering, and cursor-based pagination
  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_QUERY,
    async (_event, req: QueryDocumentsRequest): Promise<QueryDocumentsResponse> => {
      if (!req || typeof req !== 'object') {
        throw new Error('Invalid request payload');
      }
      if (!req.connectionId || typeof req.connectionId !== 'string') {
        throw new Error('Connection ID is required');
      }
      if (!req.collectionPath || typeof req.collectionPath !== 'string') {
        throw new Error('Collection path is required');
      }

      const limit = typeof req.limit === 'number' && req.limit > 0 ? req.limit : 50;
      const db = await connectionManager.getFirestore(req.connectionId);
      let query = db.collection(req.collectionPath) as FirebaseFirestore.Query;

      // 1. Apply where clauses if provided
      if (req.where && Array.isArray(req.where) && req.where.length > 0) {
        for (const clause of req.where) {
          if (!clause.field || !clause.operator) continue;
          const deserializedValue = deserializeField(clause.value, db);
          query = query.where(clause.field, clause.operator, deserializedValue);
        }
      }

      // 2. Apply orderBy if specified, otherwise order by document ID __name__
      const orderFields: { field: string; direction: 'asc' | 'desc' }[] = [];
      if (req.orderBy && req.orderBy.length > 0) {
        for (const order of req.orderBy) {
          if (!order.field) continue;
          query = query.orderBy(order.field, order.direction);
          orderFields.push({ field: order.field, direction: order.direction });
        }
      } else {
        query = query.orderBy(FieldPath.documentId(), 'asc');
        orderFields.push({ field: '__name__', direction: 'asc' });
      }

      // 3. Apply cursor if provided (startAfter)
      if (req.startAfterCursor && Array.isArray(req.startAfterCursor) && req.startAfterCursor.length > 0) {
        const rawCursorValues = req.startAfterCursor.map((c) => deserializeField(c, db));
        query = query.startAfter(...rawCursorValues);
      }

      query = query.limit(limit);

      try {
        const snapshot = await query.get();
        const documents: SerializedDocument[] = snapshot.docs.map(serializeDocument);

        // Compute nextCursor if there might be a next page
        let nextCursor: SerializedCursorValues | null = null;
        if (snapshot.docs.length === limit) {
          const lastDoc = snapshot.docs[snapshot.docs.length - 1];
          const cursorValues: SerializedCursorValues = [];

          for (const order of orderFields) {
            if (order.field === '__name__') {
              cursorValues.push(serializeFieldValue(lastDoc.id));
            } else {
              const val = lastDoc.get(order.field);
              cursorValues.push(serializeFieldValue(val));
            }
          }
          nextCursor = cursorValues;
        }

        return {
          documents,
          nextCursor,
        };
      } catch (err: unknown) {
        const error = err as { message?: string; code?: string | number };
        const msg = error?.message || String(err);

        // Check specifically for Firestore composite index required error
        const indexUrlMatch = msg.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
        if (indexUrlMatch || String(error?.code) === '9' || msg.includes('requires an index')) {
          return {
            documents: [],
            nextCursor: null,
            isIndexError: true,
            indexUrl: indexUrlMatch ? indexUrlMatch[0] : undefined,
            errorMessage: msg,
          };
        }
        throw err;
      }
    }
  );

  // Get a single document
  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_GET,
    async (_event, req: GetDocumentRequest): Promise<SerializedDocument | null> => {
      if (!req.connectionId || !req.documentPath) {
        throw new Error('connectionId and documentPath are required');
      }
      const db = await connectionManager.getFirestore(req.connectionId);
      const docSnap = await db.doc(req.documentPath).get();
      if (!docSnap.exists) {
        return null;
      }
      return serializeDocument(docSnap);
    }
  );

  // Create a new document (blank or duplicated)
  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_CREATE,
    async (_event, req: CreateDocumentRequest): Promise<SerializedDocument> => {
      if (!req.connectionId || !req.collectionPath || !req.data) {
        throw new Error('connectionId, collectionPath, and data are required');
      }
      if (credentialStore.isReadOnly(req.connectionId)) {
        throw new Error('Permission denied: Connection is in read-only mode.');
      }
      const db = await connectionManager.getFirestore(req.connectionId);
      const colRef = db.collection(req.collectionPath);

      // Deserialize all fields
      const rawData: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(req.data)) {
        rawData[key] = deserializeField(val, db);
      }

      let docRef: FirebaseFirestore.DocumentReference;
      if (req.documentId && req.documentId.trim()) {
        docRef = colRef.doc(req.documentId.trim());
        await docRef.set(rawData);
      } else {
        docRef = await colRef.add(rawData);
      }

      const createdSnap = await docRef.get();
      return serializeDocument(createdSnap);
    }
  );

  // Update a single field (scalar or nested) via dot notation
  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_UPDATE_FIELD,
    async (_event, req: UpdateFieldRequest): Promise<SerializedDocument> => {
      if (!req.connectionId || !req.documentPath || !req.fieldPath) {
        throw new Error('connectionId, documentPath, and fieldPath are required');
      }
      if (credentialStore.isReadOnly(req.connectionId)) {
        throw new Error('Permission denied: Connection is in read-only mode.');
      }
      const db = await connectionManager.getFirestore(req.connectionId);
      const docRef = db.doc(req.documentPath);

      const deserializedValue = deserializeField(req.value, db);

      await docRef.update({
        [req.fieldPath]: deserializedValue,
      });

      const updatedSnap = await docRef.get();
      return serializeDocument(updatedSnap);
    }
  );

  // Delete a document
  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_DELETE,
    async (_event, req: DeleteDocumentRequest): Promise<void> => {
      if (!req.connectionId || !req.documentPath) {
        throw new Error('connectionId and documentPath are required');
      }
      if (credentialStore.isReadOnly(req.connectionId)) {
        throw new Error('Permission denied: Connection is in read-only mode.');
      }
      const db = await connectionManager.getFirestore(req.connectionId);
      const docRef = db.doc(req.documentPath);

      if (req.recursive) {
        await db.recursiveDelete(docRef);
      } else {
        await docRef.delete();
      }
    }
  );

  // Batch delete documents chunked into <= 500 operations per Firestore WriteBatch
  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_BATCH_DELETE,
    async (_event, req: BatchDeleteDocumentsRequest): Promise<BatchDeleteDocumentsResponse> => {
      if (!req.connectionId || !req.documentPaths || !Array.isArray(req.documentPaths)) {
        throw new Error('connectionId and documentPaths array are required');
      }
      if (credentialStore.isReadOnly(req.connectionId)) {
        throw new Error('Permission denied: Connection is in read-only mode.');
      }

      if (req.documentPaths.length === 0) {
        return { deleted: 0, batchCount: 0 };
      }

      const db = await connectionManager.getFirestore(req.connectionId);
      const CHUNK_SIZE = 500;
      let totalDeleted = 0;
      let batchCount = 0;

      for (let i = 0; i < req.documentPaths.length; i += CHUNK_SIZE) {
        const chunk = req.documentPaths.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();

        for (const docPath of chunk) {
          batch.delete(db.doc(docPath));
        }

        await batch.commit();
        totalDeleted += chunk.length;
        batchCount++;
      }

      return {
        deleted: totalDeleted,
        batchCount,
      };
    }
  );
}
