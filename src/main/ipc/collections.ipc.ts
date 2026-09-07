import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  ListCollectionsRequest,
  ListSubcollectionsRequest,
  CollectionInfo,
} from '@shared/ipc-types';
import { connectionManager } from '../firebase/connectionManager';

export function registerCollectionsIpc(): void {
  // List top-level collections or subcollections
  ipcMain.handle(
    IPC_CHANNELS.COLLECTIONS_LIST,
    async (_event, req: ListCollectionsRequest): Promise<CollectionInfo[]> => {
      if (!req || typeof req !== 'object') {
        throw new Error('Invalid request payload');
      }
      if (!req.connectionId || typeof req.connectionId !== 'string') {
        throw new Error('Connection ID is required');
      }

      return connectionManager.listCollections(req.connectionId, req.parentPath);
    }
  );

  // List subcollection names under a document
  ipcMain.handle(
    IPC_CHANNELS.SUBCOLLECTIONS_LIST,
    async (_event, req: ListSubcollectionsRequest): Promise<string[]> => {
      if (!req || !req.connectionId || !req.documentPath) {
        throw new Error('connectionId and documentPath are required');
      }

      const db = await connectionManager.getFirestore(req.connectionId);
      const docRef = db.doc(req.documentPath);
      const subcollections = await docRef.listCollections();
      return subcollections.map((col) => col.id);
    }
  );
}
