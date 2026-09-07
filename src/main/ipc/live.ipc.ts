import { ipcMain } from 'electron';
import { FieldPath } from 'firebase-admin/firestore';
import {
  IPC_CHANNELS,
  LiveSubscribeRequest,
  LiveUpdateEvent,
} from '@shared/ipc-types';
import { connectionManager } from '../firebase/connectionManager';
import { serializeDocument, deserializeField } from '../firebase/serializer';

export function registerLiveIpc(): void {
  // Store active unsubscriber callbacks: key -> unsubscribe function
  const activeSubscriptions: Map<string, () => void> = new Map();

  ipcMain.handle(
    IPC_CHANNELS.LIVE_SUBSCRIBE,
    async (event, req: LiveSubscribeRequest): Promise<boolean> => {
      if (!req.connectionId || !req.collectionPath) {
        throw new Error('connectionId and collectionPath are required');
      }

      const key = `${req.connectionId}:${req.collectionPath}`;

      // Clean up previous listener for this collection if any
      const existing = activeSubscriptions.get(key);
      if (existing) {
        existing();
        activeSubscriptions.delete(key);
      }

      const db = await connectionManager.getFirestore(req.connectionId);
      let query: FirebaseFirestore.Query = db.collection(req.collectionPath);

      // Apply where clauses
      if (req.where && req.where.length > 0) {
        for (const w of req.where) {
          const fieldPath = new FieldPath(...w.field.split('.'));
          const deserializedValue = deserializeField(w.value, db);
          query = query.where(fieldPath, w.operator, deserializedValue);
        }
      }

      // Apply order clauses
      if (req.orderBy && req.orderBy.length > 0) {
        for (const o of req.orderBy) {
          const fieldPath = new FieldPath(...o.field.split('.'));
          query = query.orderBy(fieldPath, o.direction);
        }
      }

      // Apply limit
      const limit = req.limit || 50;
      query = query.limit(limit);

      // Attach Firestore onSnapshot listener
      const unsubscribe = query.onSnapshot(
        (snapshot) => {
          const documents = snapshot.docs.map((d) => serializeDocument(d));
          const updatePayload: LiveUpdateEvent = {
            connectionId: req.connectionId,
            collectionPath: req.collectionPath,
            documents,
          };

          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.LIVE_UPDATE_EVENT, updatePayload);
          }
        },
        (err) => {
          console.error(`[Live onSnapshot Error] ${req.collectionPath}:`, err);
        }
      );

      activeSubscriptions.set(key, unsubscribe);
      return true;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LIVE_UNSUBSCRIBE,
    async (_event, collectionPath: string): Promise<boolean> => {
      let found = false;
      for (const [key, unsub] of activeSubscriptions.entries()) {
        if (key.endsWith(`:${collectionPath}`)) {
          unsub();
          activeSubscriptions.delete(key);
          found = true;
        }
      }
      return found;
    }
  );
}
