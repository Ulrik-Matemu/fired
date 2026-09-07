import { Timestamp, GeoPoint, DocumentReference, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import {
  SerializedFieldValue,
  SerializedDocument,
  SerializedTimestamp,
} from '@shared/firestore-types';

/**
 * Serializes any Firestore SDK or JavaScript value into a SerializedFieldValue discriminated union.
 */
export function serializeFieldValue(val: unknown): SerializedFieldValue {
  if (val === null || val === undefined) {
    return { __type: 'null', value: null };
  }

  // 1. Primitive types
  if (typeof val === 'string') {
    return { __type: 'string', value: val };
  }
  if (typeof val === 'number') {
    return { __type: 'number', value: val };
  }
  if (typeof val === 'boolean') {
    return { __type: 'boolean', value: val };
  }

  // 2. Buffer / Uint8Array (Bytes)
  if (Buffer.isBuffer(val)) {
    return { __type: 'bytes', value: val.toString('base64') };
  }
  if (val instanceof Uint8Array) {
    return { __type: 'bytes', value: Buffer.from(val).toString('base64') };
  }

  // 3. Firestore Timestamp
  if (val instanceof Timestamp) {
    return {
      __type: 'timestamp',
      value: {
        seconds: val.seconds,
        nanoseconds: val.nanoseconds,
        iso: val.toDate().toISOString(),
      },
    };
  }
  // Duck-typing for Timestamp-like objects (e.g. from gRPC or cache)
  if (
    typeof val === 'object' &&
    val !== null &&
    (('_seconds' in val && '_nanoseconds' in val) ||
      ('seconds' in val && 'nanoseconds' in val && 'toDate' in val))
  ) {
    const tsObj = val as { _seconds?: number; seconds?: number; _nanoseconds?: number; nanoseconds?: number; toDate?: () => Date };
    const seconds = tsObj.seconds !== undefined ? tsObj.seconds : tsObj._seconds ?? 0;
    const nanoseconds = tsObj.nanoseconds !== undefined ? tsObj.nanoseconds : tsObj._nanoseconds ?? 0;
    const date = typeof tsObj.toDate === 'function' ? tsObj.toDate() : new Date(seconds * 1000 + nanoseconds / 1000000);
    return {
      __type: 'timestamp',
      value: {
        seconds,
        nanoseconds,
        iso: date.toISOString(),
      },
    };
  }

  // 4. Firestore GeoPoint
  if (val instanceof GeoPoint) {
    return {
      __type: 'geopoint',
      value: {
        latitude: val.latitude,
        longitude: val.longitude,
      },
    };
  }
  // Duck-typing for GeoPoint
  if (
    typeof val === 'object' &&
    val !== null &&
    (('_latitude' in val && '_longitude' in val) ||
      ('latitude' in val && 'longitude' in val && typeof (val as { isEqual?: unknown }).isEqual === 'function'))
  ) {
    const gpObj = val as { _latitude?: number; latitude?: number; _longitude?: number; longitude?: number };
    return {
      __type: 'geopoint',
      value: {
        latitude: gpObj.latitude !== undefined ? gpObj.latitude : gpObj._latitude ?? 0,
        longitude: gpObj.longitude !== undefined ? gpObj.longitude : gpObj._longitude ?? 0,
      },
    };
  }

  // 5. Firestore DocumentReference
  if (val instanceof DocumentReference) {
    return {
      __type: 'reference',
      value: {
        path: val.path,
        collectionId: val.parent.id,
        documentId: val.id,
      },
    };
  }
  // Duck-typing for DocumentReference
  if (
    typeof val === 'object' &&
    val !== null &&
    'path' in val &&
    'id' in val &&
    'parent' in val &&
    'firestore' in val
  ) {
    const ref = val as DocumentReference;
    return {
      __type: 'reference',
      value: {
        path: ref.path,
        collectionId: ref.parent.id,
        documentId: ref.id,
      },
    };
  }

  // 6. JavaScript Array
  if (Array.isArray(val)) {
    return {
      __type: 'array',
      value: val.map(serializeFieldValue),
    };
  }

  // 7. Plain Object / Map
  if (typeof val === 'object') {
    const record = val as Record<string, unknown>;
    const mapVal: Record<string, SerializedFieldValue> = {};
    for (const key of Object.keys(record)) {
      mapVal[key] = serializeFieldValue(record[key]);
    }
    return {
      __type: 'map',
      value: mapVal,
    };
  }

  // Fallback for symbols, functions, etc.
  return { __type: 'string', value: String(val) };
}

/**
 * Deserializes a SerializedFieldValue back into its native Firestore / JavaScript representation.
 * When `db` is provided, DocumentReference can be reconstructed as a real DocumentReference instance.
 */
export function deserializeField(field: SerializedFieldValue, db?: Firestore): unknown {
  switch (field.__type) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      return field.value;

    case 'bytes':
      return Buffer.from(field.value, 'base64');

    case 'timestamp':
      return new Timestamp(field.value.seconds, field.value.nanoseconds);

    case 'geopoint':
      return new GeoPoint(field.value.latitude, field.value.longitude);

    case 'reference':
      if (db) {
        return db.doc(field.value.path);
      }
      return {
        path: field.value.path,
        id: field.value.documentId,
      };

    case 'array':
      return field.value.map((item) => deserializeField(item, db));

    case 'map': {
      const res: Record<string, unknown> = {};
      for (const key of Object.keys(field.value)) {
        res[key] = deserializeField(field.value[key], db);
      }
      return res;
    }

    default:
      return null;
  }
}

/**
 * Serializes a full Firestore DocumentSnapshot into a SerializedDocument.
 */
export function serializeDocument(docSnapshot: DocumentSnapshot): SerializedDocument {
  const data = docSnapshot.data() || {};
  const fields: Record<string, SerializedFieldValue> = {};

  for (const key of Object.keys(data)) {
    fields[key] = serializeFieldValue(data[key]);
  }

  let createTime: SerializedTimestamp | null = null;
  if (docSnapshot.createTime) {
    createTime = {
      seconds: docSnapshot.createTime.seconds,
      nanoseconds: docSnapshot.createTime.nanoseconds,
      iso: docSnapshot.createTime.toDate().toISOString(),
    };
  }

  let updateTime: SerializedTimestamp | null = null;
  if (docSnapshot.updateTime) {
    updateTime = {
      seconds: docSnapshot.updateTime.seconds,
      nanoseconds: docSnapshot.updateTime.nanoseconds,
      iso: docSnapshot.updateTime.toDate().toISOString(),
    };
  }

  return {
    __id: docSnapshot.id,
    __path: docSnapshot.ref.path,
    __createTime: createTime,
    __updateTime: updateTime,
    fields,
  };
}
