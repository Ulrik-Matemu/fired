import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { FieldPath } from 'firebase-admin/firestore';
import {
  IPC_CHANNELS,
  ExportCollectionRequest,
  ImportExportResult,
} from '@shared/ipc-types';
import { SerializedDocument, SerializedFieldValue } from '@shared/firestore-types';
import { connectionManager } from '../firebase/connectionManager';
import { serializeDocument, deserializeField } from '../firebase/serializer';

// Convert SerializedFieldValue to plain JavaScript representation for JSON/CSV safely
function serializedToPlain(val: SerializedFieldValue | undefined | null): unknown {
  if (!val || typeof val !== 'object' || !val.__type) {
    return val ?? null;
  }

  switch (val.__type) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      return val.value ?? null;
    case 'timestamp':
      return val.value ? val.value.iso : null;
    case 'geopoint':
      return val.value ? { latitude: val.value.latitude, longitude: val.value.longitude } : null;
    case 'reference':
      return val.value ? val.value.path : null;
    case 'bytes':
      return val.value ?? '';
    case 'array':
      return Array.isArray(val.value) ? val.value.map(serializedToPlain) : [];
    case 'map': {
      const res: Record<string, unknown> = {};
      if (val.value && typeof val.value === 'object') {
        for (const k of Object.keys(val.value)) {
          res[k] = serializedToPlain(val.value[k]);
        }
      }
      return res;
    }
    default:
      return (val as { value?: unknown }).value ?? null;
  }
}

function documentToPlainObject(doc: SerializedDocument): Record<string, unknown> {
  const obj: Record<string, unknown> = { id: doc.__id || '' };
  if (doc.fields && typeof doc.fields === 'object') {
    for (const [key, val] of Object.entries(doc.fields)) {
      obj[key] = serializedToPlain(val);
    }
  }
  return obj;
}

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str: string;
  if (typeof val === 'object') {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Flatten an object up to 1 level deep for CSV column generation
function flattenForCsv(obj: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      for (const [subK, subV] of Object.entries(v as Record<string, unknown>)) {
        flat[`${k}.${subK}`] = subV;
      }
    } else {
      flat[k] = v;
    }
  }
  return flat;
}

export function registerExportIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_COLLECTION,
    async (_event, req: ExportCollectionRequest): Promise<ImportExportResult> => {
      try {
        console.log('[ExportIPC] Received export request:', {
          connectionId: req?.connectionId,
          collectionPath: req?.collectionPath,
          filePath: req?.filePath,
          format: req?.format,
          scope: req?.scope,
          hasCurrentDocs: !!req?.currentDocuments,
          currentDocsCount: req?.currentDocuments?.length,
        });

        if (!req || typeof req !== 'object') {
          throw new Error('Invalid export request');
        }
        if (!req.filePath) {
          throw new Error('Destination file path is required');
        }

        let documentsToExport: SerializedDocument[] = [];

        if (req.scope === 'current' && req.currentDocuments) {
          // Export in-memory loaded documents passed from client
          documentsToExport = req.currentDocuments;
        } else {
          // Export all matching documents across collection via cursor pagination
          const db = await connectionManager.getFirestore(req.connectionId);
          let hasMore = true;
          let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;
          const pageSize = 100;

          while (hasMore) {
            let query = db.collection(req.collectionPath) as FirebaseFirestore.Query;

            if (req.where && req.where.length > 0) {
              for (const clause of req.where) {
                if (!clause.field || !clause.operator) continue;
                const deserializedVal = deserializeField(clause.value, db);
                query = query.where(clause.field, clause.operator, deserializedVal);
              }
            }

            if (req.orderBy && req.orderBy.length > 0) {
              for (const order of req.orderBy) {
                if (!order.field) continue;
                query = query.orderBy(order.field, order.direction);
              }
            } else {
              query = query.orderBy(FieldPath.documentId(), 'asc');
            }

            if (lastDoc) {
              query = query.startAfter(lastDoc);
            }

            query = query.limit(pageSize);
            const snap = await query.get();

            if (snap.empty) {
              hasMore = false;
              break;
            }

            for (const doc of snap.docs) {
              documentsToExport.push(serializeDocument(doc));
            }

            if (snap.docs.length < pageSize) {
              hasMore = false;
            } else {
              lastDoc = snap.docs[snap.docs.length - 1];
            }
          }
        }

        // Ensure parent directory exists
        const dir = path.dirname(req.filePath);
        await fs.mkdir(dir, { recursive: true });

        // Format and write file
        if (req.format === 'json') {
          const plainDocs = documentsToExport.map(documentToPlainObject);
          const jsonContent = JSON.stringify(plainDocs, null, 2);
          await fs.writeFile(req.filePath, jsonContent, 'utf-8');
        } else {
          // CSV
          const plainDocs = documentsToExport.map(documentToPlainObject);
          const flattenedDocs = plainDocs.map(flattenForCsv);

          // Gather all unique column headers
          const headerSet = new Set<string>();
          headerSet.add('id');
          for (const doc of flattenedDocs) {
            for (const k of Object.keys(doc)) {
              headerSet.add(k);
            }
          }
          const headers = Array.from(headerSet);

          const csvLines: string[] = [];
          csvLines.push(headers.map(escapeCsvValue).join(','));

          for (const doc of flattenedDocs) {
            const row = headers.map((h) => escapeCsvValue(doc[h]));
            csvLines.push(row.join(','));
          }

          await fs.writeFile(req.filePath, csvLines.join('\n'), 'utf-8');
        }

        console.log(`[ExportIPC] Successfully exported ${documentsToExport.length} documents to ${req.filePath}`);
        return {
          success: true,
          count: documentsToExport.length,
        };
      } catch (err: unknown) {
        console.error('[ExportIPC] Error exporting collection:', err);
        return {
          success: false,
          count: 0,
          error: (err as Error).message,
        };
      }
    }
  );
}
