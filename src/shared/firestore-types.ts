/**
 * Firefoo Serialized Field Types
 *
 * All Firestore data crossing the Electron IPC boundary conforms to
 * these discriminated union types to prevent object degradation or
 * prototype stripping by structured cloning.
 */

export interface SerializedTimestamp {
  seconds: number;
  nanoseconds: number;
  iso: string;
}

export interface SerializedGeoPoint {
  latitude: number;
  longitude: number;
}

export interface SerializedReference {
  path: string;
  collectionId: string;
  documentId: string;
}

export type SerializedFieldValue =
  | { __type: 'string'; value: string }
  | { __type: 'number'; value: number }
  | { __type: 'boolean'; value: boolean }
  | { __type: 'null'; value: null }
  | { __type: 'timestamp'; value: SerializedTimestamp }
  | { __type: 'geopoint'; value: SerializedGeoPoint }
  | { __type: 'reference'; value: SerializedReference }
  | { __type: 'bytes'; value: string } // base64 encoded
  | { __type: 'map'; value: Record<string, SerializedFieldValue> }
  | { __type: 'array'; value: SerializedFieldValue[] };

export type FieldType = SerializedFieldValue['__type'];

export type SerializedCursorValues = SerializedFieldValue[];

export interface SerializedDocument {
  __id: string;
  __path: string;
  __createTime: SerializedTimestamp | null;
  __updateTime: SerializedTimestamp | null;
  fields: Record<string, SerializedFieldValue>;
}
