import { ipcMain } from 'electron';
import fs from 'fs/promises';
import {
  IPC_CHANNELS,
  BackupDatabaseRequest,
  BackupDatabaseResponse,
  RestoreInspectRequest,
  RestoreInspectResponse,
  RestoreCommitRequest,
  RestoreCommitResponse,
} from '@shared/ipc-types';
import { SerializedDocument } from '@shared/firestore-types';
import { connectionManager } from '../firebase/connectionManager';
import { credentialStore } from '../storage/credentialStore';
import { serializeDocument, deserializeField } from '../firebase/serializer';

interface BackupArchiveSchema {
  format: 'fired-backup-v1' | 'firefoo-backup-v1';
  version: 1;
  timestamp: number;
  projectId: string;
  collections: Record<string, SerializedDocument[]>;
}

export function registerBackupIpc(): void {
  // ── 1. Backup Database / Collections ──
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_DATABASE,
    async (_event, req: BackupDatabaseRequest): Promise<BackupDatabaseResponse> => {
      try {
        if (!req.connectionId || !req.filePath) {
          throw new Error('connectionId and filePath are required');
        }

        const meta = await credentialStore.getConnectionMetadata(req.connectionId);
        const db = await connectionManager.getFirestore(req.connectionId);

        let targetCollections = req.collectionPaths;
        if (!targetCollections || targetCollections.length === 0) {
          const topCols = await db.listCollections();
          targetCollections = topCols.map((c) => c.path);
        }

        const archive: BackupArchiveSchema = {
          format: 'fired-backup-v1',
          version: 1,
          timestamp: Date.now(),
          projectId: meta?.projectId || 'unknown',
          collections: {},
        };

        let totalDocs = 0;

        for (const colPath of targetCollections) {
          const colRef = db.collection(colPath);
          const snapshot = await colRef.get();
          const serializedDocs = snapshot.docs.map((d) => serializeDocument(d));
          archive.collections[colPath] = serializedDocs;
          totalDocs += serializedDocs.length;
        }

        const jsonString = JSON.stringify(archive, null, 2);
        await fs.writeFile(req.filePath, jsonString, 'utf-8');

        return {
          success: true,
          totalCollections: targetCollections.length,
          totalDocuments: totalDocs,
          filePath: req.filePath,
        };
      } catch (err) {
        return {
          success: false,
          totalCollections: 0,
          totalDocuments: 0,
          filePath: req.filePath,
          error: (err as Error).message,
        };
      }
    }
  );

  // ── 2. Inspect Backup Archive File (Pre-flight) ──
  ipcMain.handle(
    IPC_CHANNELS.RESTORE_INSPECT,
    async (_event, req: RestoreInspectRequest): Promise<RestoreInspectResponse> => {
      try {
        if (!req.filePath) {
          throw new Error('filePath is required');
        }

        const content = await fs.readFile(req.filePath, 'utf-8');
        const parsed: BackupArchiveSchema = JSON.parse(content);

        if ((parsed.format !== 'fired-backup-v1' && parsed.format !== 'firefoo-backup-v1') || !parsed.collections) {
          throw new Error('Invalid backup file format. Expected a Fired backup archive.');
        }

        const collectionsSummary: { name: string; docCount: number }[] = [];
        let totalDocs = 0;

        for (const [colName, docs] of Object.entries(parsed.collections)) {
          const count = Array.isArray(docs) ? docs.length : 0;
          collectionsSummary.push({ name: colName, docCount: count });
          totalDocs += count;
        }

        return {
          success: true,
          projectId: parsed.projectId || 'unknown',
          timestamp: parsed.timestamp || Date.now(),
          collections: collectionsSummary,
          totalDocuments: totalDocs,
        };
      } catch (err) {
        return {
          success: false,
          projectId: '',
          timestamp: 0,
          collections: [],
          totalDocuments: 0,
          error: (err as Error).message,
        };
      }
    }
  );

  // ── 3. Commit Restore with 500-Write Batch Chunking & Read-Only Guard ──
  ipcMain.handle(
    IPC_CHANNELS.RESTORE_COMMIT,
    async (_event, req: RestoreCommitRequest): Promise<RestoreCommitResponse> => {
      try {
        if (!req.connectionId || !req.filePath) {
          throw new Error('connectionId and filePath are required');
        }

        // Security boundary check: strictly block restore on read-only projects
        if (credentialStore.isReadOnly(req.connectionId)) {
          throw new Error('Permission denied: Connection is in read-only mode.');
        }

        const db = await connectionManager.getFirestore(req.connectionId);
        const content = await fs.readFile(req.filePath, 'utf-8');
        const archive: BackupArchiveSchema = JSON.parse(content);

        if ((archive.format !== 'fired-backup-v1' && archive.format !== 'firefoo-backup-v1') || !archive.collections) {
          throw new Error('Invalid backup archive.');
        }

        const collectionsToRestore = req.selectedCollections && req.selectedCollections.length > 0
          ? req.selectedCollections
          : Object.keys(archive.collections);

        let totalCommitted = 0;
        let totalSkipped = 0;
        let batchCount = 0;
        const BATCH_SIZE = 500;

        for (const colPath of collectionsToRestore) {
          const docs = archive.collections[colPath] || [];
          if (docs.length === 0) continue;

          for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const chunk = docs.slice(i, i + BATCH_SIZE);
            const batch = db.batch();

            for (const doc of chunk) {
              const docRef = db.collection(colPath).doc(doc.__id);

              if (req.strategy === 'skip') {
                const existingSnap = await docRef.get();
                if (existingSnap.exists) {
                  totalSkipped++;
                  continue;
                }
              }

              const rawData: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(doc.fields || {})) {
                rawData[k] = deserializeField(v, db);
              }

              batch.set(docRef, rawData, { merge: req.strategy === 'overwrite' });
              totalCommitted++;
            }

            await batch.commit();
            batchCount++;
          }
        }

        return {
          success: true,
          committed: totalCommitted,
          skipped: totalSkipped,
          batchCount,
        };
      } catch (err) {
        return {
          success: false,
          committed: 0,
          skipped: 0,
          batchCount: 0,
          error: (err as Error).message,
        };
      }
    }
  );
}
