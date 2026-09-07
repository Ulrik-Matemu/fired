import { ipcMain } from 'electron';
import fs from 'fs/promises';
import crypto from 'crypto';
import {
  IPC_CHANNELS,
  ImportPlanRequest,
  ImportPlanResponse,
  ImportCommitRequest,
  ImportCommitResponse,
  ParsedImportDoc,
  ImportConflict,
  SchemaWarning,
} from '@shared/ipc-types';
import { SerializedFieldValue, SerializedDocument } from '@shared/firestore-types';
import { connectionManager } from '../firebase/connectionManager';
import { credentialStore } from '../storage/credentialStore';
import { serializeDocument, deserializeField } from '../firebase/serializer';

// Parse a raw primitive or JSON object to SerializedFieldValue
function plainToSerialized(val: unknown): SerializedFieldValue {
  if (val === null || val === undefined) {
    return { __type: 'null', value: null };
  }
  if (typeof val === 'number') {
    return { __type: 'number', value: val };
  }
  if (typeof val === 'boolean') {
    return { __type: 'boolean', value: val };
  }
  if (typeof val === 'string') {
    // Check if ISO Date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return {
          __type: 'timestamp',
          value: {
            seconds: Math.floor(d.getTime() / 1000),
            nanoseconds: (d.getTime() % 1000) * 1000000,
            iso: d.toISOString(),
          },
        };
      }
    }
    return { __type: 'string', value: val };
  }
  if (Array.isArray(val)) {
    return { __type: 'array', value: val.map(plainToSerialized) };
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const mapVal: Record<string, SerializedFieldValue> = {};
    for (const [k, v] of Object.entries(obj)) {
      mapVal[k] = plainToSerialized(v);
    }
    return { __type: 'map', value: mapVal };
  }
  return { __type: 'string', value: String(val) };
}

// Expand a dot-notation key like "user.address.city" into a nested plain JS object
function setNestedProperty(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let curr = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!curr[p] || typeof curr[p] !== 'object') {
      curr[p] = {};
    }
    curr = curr[p] as Record<string, unknown>;
  }
  curr[parts[parts.length - 1]] = value;
}

// Parse a single CSV line respecting quoted strings
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let curr = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        curr += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(curr.trim());
      curr = '';
    } else {
      curr += char;
    }
  }
  values.push(curr.trim());
  return values;
}

// Convert a CSV row into a ParsedImportDoc
function parseCsvRowToDoc(headers: string[], values: string[]): ParsedImportDoc {
  const nestedPlain: Record<string, unknown> = {};
  let docId = '';

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const rawVal = values[i] ?? '';

    if (header === 'id' || header === '__id') {
      docId = rawVal;
      continue;
    }

    if (!header || rawVal === '') continue;

    let parsedVal: unknown = rawVal;

    // Check if cell is a JSON object or array
    if ((rawVal.startsWith('{') && rawVal.endsWith('}')) || (rawVal.startsWith('[') && rawVal.endsWith(']'))) {
      try {
        parsedVal = JSON.parse(rawVal);
      } catch {
        parsedVal = rawVal;
      }
    } else if (rawVal.toLowerCase() === 'true') {
      parsedVal = true;
    } else if (rawVal.toLowerCase() === 'false') {
      parsedVal = false;
    } else if (rawVal.toLowerCase() === 'null') {
      parsedVal = null;
    } else if (!isNaN(Number(rawVal)) && rawVal.trim() !== '') {
      parsedVal = Number(rawVal);
    }

    setNestedProperty(nestedPlain, header, parsedVal);
  }

  const fields: Record<string, SerializedFieldValue> = {};
  for (const [k, v] of Object.entries(nestedPlain)) {
    fields[k] = plainToSerialized(v);
  }

  return {
    documentId: docId || crypto.randomUUID(),
    fields,
  };
}

export function registerImportIpc(): void {
  // Step 1: Dry-Run / Plan
  ipcMain.handle(
    IPC_CHANNELS.IMPORT_PLAN,
    async (_event, req: ImportPlanRequest): Promise<ImportPlanResponse> => {
      try {
        if (!req.filePath) throw new Error('File path is required');
        if (!req.connectionId) throw new Error('Connection ID is required');
        if (!req.collectionPath) throw new Error('Collection path is required');

        const fileContent = await fs.readFile(req.filePath, 'utf-8');
        const isJson = req.filePath.toLowerCase().endsWith('.json');
        const parsedDocs: ParsedImportDoc[] = [];

        if (isJson) {
          const rawParsed = JSON.parse(fileContent);
          if (!Array.isArray(rawParsed)) {
            throw new Error('Import JSON file must contain an array of document objects ([ { ... }, { ... } ])');
          }

          for (const item of rawParsed) {
            if (!item || typeof item !== 'object') continue;
            const docId = String(item.id || item.__id || crypto.randomUUID());
            const fields: Record<string, SerializedFieldValue> = {};

            for (const [k, v] of Object.entries(item)) {
              if (k === 'id' || k === '__id') continue;
              fields[k] = plainToSerialized(v);
            }

            parsedDocs.push({ documentId: docId, fields });
          }
        } else {
          // CSV
          const lines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length < 2) {
            throw new Error('CSV file must have at least a header row and one data row.');
          }

          const headers = parseCsvLine(lines[0]);
          for (let i = 1; i < lines.length; i++) {
            const rowValues = parseCsvLine(lines[i]);
            parsedDocs.push(parseCsvRowToDoc(headers, rowValues));
          }
        }

        const db = await connectionManager.getFirestore(req.connectionId);
        const colRef = db.collection(req.collectionPath);

        // Deduplicate incoming docs by documentId (keep last occurrence)
        const docMap = new Map<string, ParsedImportDoc>();
        for (const doc of parsedDocs) {
          docMap.set(doc.documentId, doc);
        }
        const uniqueIncomingDocs = Array.from(docMap.values());

        // Check which document IDs already exist in Firestore via chunked getAll (100 per chunk)
        const existingDocsMap = new Map<string, SerializedDocument>();
        const CHUNK_SIZE = 100;
        const allDocIds = uniqueIncomingDocs.map((d) => d.documentId);

        for (let i = 0; i < allDocIds.length; i += CHUNK_SIZE) {
          const chunkIds = allDocIds.slice(i, i + CHUNK_SIZE);
          const docRefs = chunkIds.map((id) => colRef.doc(id));
          const snapshots = await db.getAll(...docRefs);

          for (const snap of snapshots) {
            if (snap.exists) {
              existingDocsMap.set(snap.id, serializeDocument(snap));
            }
          }
        }

        // Build target collection field type dictionary for schema warnings
        const targetFieldTypes = new Map<string, string>();
        for (const existingDoc of existingDocsMap.values()) {
          for (const [fName, fVal] of Object.entries(existingDoc.fields)) {
            if (!targetFieldTypes.has(fName) && fVal.__type !== 'null') {
              targetFieldTypes.set(fName, fVal.__type);
            }
          }
        }

        const newDocs: ParsedImportDoc[] = [];
        const conflicts: ImportConflict[] = [];
        const schemaWarnings: SchemaWarning[] = [];

        for (const doc of uniqueIncomingDocs) {
          const existing = existingDocsMap.get(doc.documentId);

          if (existing) {
            // Conflict
            conflicts.push({
              documentId: doc.documentId,
              documentPath: existing.__path,
              existingFields: existing.fields,
              incomingFields: doc.fields,
            });
          } else {
            // New Document
            newDocs.push(doc);
          }

          // Check for schema type mismatches
          for (const [field, val] of Object.entries(doc.fields)) {
            const expectedType = targetFieldTypes.get(field);
            if (expectedType && val.__type !== 'null' && val.__type !== expectedType) {
              schemaWarnings.push({
                documentId: doc.documentId,
                field,
                expectedType,
                incomingType: val.__type,
                message: `Field "${field}" is "${expectedType}" in existing documents, but "${val.__type}" in this row.`,
              });
            }
          }
        }

        return {
          success: true,
          totalIncoming: uniqueIncomingDocs.length,
          newCount: newDocs.length,
          conflictCount: conflicts.length,
          conflicts,
          schemaWarnings,
          newDocuments: newDocs,
          sourceFormat: isJson ? 'json' : 'csv',
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as Error).message,
          totalIncoming: 0,
          newCount: 0,
          conflictCount: 0,
          conflicts: [],
          schemaWarnings: [],
          newDocuments: [],
          sourceFormat: req.filePath?.endsWith('.csv') ? 'csv' : 'json',
        };
      }
    }
  );

  // Step 2: Commit
  ipcMain.handle(
    IPC_CHANNELS.IMPORT_COMMIT,
    async (_event, req: ImportCommitRequest): Promise<ImportCommitResponse> => {
      try {
        if (!req.connectionId || !req.collectionPath) {
          throw new Error('connectionId and collectionPath are required');
        }
        if (credentialStore.isReadOnly(req.connectionId)) {
          throw new Error('Permission denied: Connection is in read-only mode.');
        }

        const db = await connectionManager.getFirestore(req.connectionId);
        const colRef = db.collection(req.collectionPath);

        // Gather all documents to write:
        // 1. All newDocuments
        // 2. All resolvedConflicts with action === 'overwrite'
        const docsToWrite: { id: string; fields: Record<string, SerializedFieldValue> }[] = [];
        let skippedCount = 0;

        for (const newDoc of req.newDocuments) {
          docsToWrite.push({ id: newDoc.documentId, fields: newDoc.fields });
        }

        for (const resolved of req.resolvedConflicts) {
          if (resolved.action === 'overwrite') {
            docsToWrite.push({ id: resolved.documentId, fields: resolved.fields });
          } else {
            skippedCount++;
          }
        }

        const BATCH_LIMIT = 500;
        let committedCount = 0;
        let batchCount = 0;

        for (let i = 0; i < docsToWrite.length; i += BATCH_LIMIT) {
          const chunk = docsToWrite.slice(i, i + BATCH_LIMIT);
          const batch = db.batch();

          for (const item of chunk) {
            const rawData: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(item.fields)) {
              rawData[k] = deserializeField(v, db);
            }
            batch.set(colRef.doc(item.id), rawData);
          }

          await batch.commit();
          committedCount += chunk.length;
          batchCount++;
        }

        return {
          success: true,
          committed: committedCount,
          skipped: skippedCount,
          batchCount,
        };
      } catch (err: unknown) {
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
