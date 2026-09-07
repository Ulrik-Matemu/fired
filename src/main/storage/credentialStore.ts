import { safeStorage } from 'electron';
import Store from 'electron-store';
import crypto from 'crypto';
import { ConnectionInfo } from '@shared/ipc-types';

interface StoreSchema {
  connections: Record<string, ConnectionInfo>;
  encryptedCredentials: Record<string, string>; // base64 representation of encrypted buffer
}

// Fallback encryption if safeStorage is unavailable (e.g. headless/Linux without desktop keychain)
const FALLBACK_KEY = crypto.createHash('sha256').update('firefoo-desktop-secure-store-fallback-key').digest();

function encryptFallback(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', FALLBACK_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `fallback:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptFallback(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'fallback') {
    throw new Error('Invalid fallback encrypted credential format');
  }
  const [, ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', FALLBACK_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const StoreConstructor = ((Store as unknown as { default?: typeof Store }).default || Store) as typeof Store;

class CredentialStore {
  private _store: Store<StoreSchema> | null = null;

  private get store(): Store<StoreSchema> {
    if (!this._store) {
      this._store = new StoreConstructor<StoreSchema>({
        name: 'fired-connections',
        defaults: {
          connections: {},
          encryptedCredentials: {},
        },
      });

      // Seamless migration from legacy firefoo-connections
      try {
        const legacyStore = new StoreConstructor<StoreSchema>({ name: 'firefoo-connections' });
        const legacyConnections = legacyStore.get('connections') || {};
        const legacyCredentials = legacyStore.get('encryptedCredentials') || {};
        const currentConnections = this._store.get('connections') || {};

        if (Object.keys(currentConnections).length === 0 && Object.keys(legacyConnections).length > 0) {
          this._store.set('connections', legacyConnections);
          this._store.set('encryptedCredentials', legacyCredentials);
        }
      } catch {
        // Ignore migration error if legacy store doesn't exist
      }
    }
    return this._store;
  }

  /**
   * Save a service account credential and its metadata.
   * Metadata is stored unencrypted so listing connections never requires secret decryption.
   * The secret JSON is encrypted via safeStorage (or fallback).
   */
  async saveCredential(
    id: string,
    metadata: { name: string; projectId: string; clientEmail: string },
    serviceAccountJson: string
  ): Promise<ConnectionInfo> {
    let encryptedBase64: string;

    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(serviceAccountJson);
      encryptedBase64 = `safe:${buffer.toString('base64')}`;
    } else {
      console.warn('[CredentialStore] Electron safeStorage is unavailable. Using AES-256-GCM fallback.');
      encryptedBase64 = encryptFallback(serviceAccountJson);
    }

    const connectionInfo: ConnectionInfo = {
      id,
      name: metadata.name,
      projectId: metadata.projectId,
      clientEmail: metadata.clientEmail,
      createdAt: Date.now(),
    };

    const currentConnections = this.store.get('connections', {});
    const currentCredentials = this.store.get('encryptedCredentials', {});

    this.store.set('connections', {
      ...currentConnections,
      [id]: connectionInfo,
    });

    this.store.set('encryptedCredentials', {
      ...currentCredentials,
      [id]: encryptedBase64,
    });

    return connectionInfo;
  }

  /**
   * Decrypt and return the service account JSON for a connection ID.
   */
  async getCredential(id: string): Promise<string> {
    const credentials = this.store.get('encryptedCredentials', {});
    const payload = credentials[id];

    if (!payload) {
      throw new Error(`Credential not found for connection ${id}`);
    }

    if (payload.startsWith('safe:')) {
      if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
        throw new Error('Cannot decrypt credential: OS safeStorage is currently unavailable.');
      }
      const buffer = Buffer.from(payload.slice(5), 'base64');
      return safeStorage.decryptString(buffer);
    } else if (payload.startsWith('fallback:')) {
      return decryptFallback(payload);
    } else {
      // Legacy raw base64 or unsupported
      throw new Error('Unrecognized credential encryption format.');
    }
  }

  /**
   * Delete a connection and its associated credentials.
   */
  async deleteCredential(id: string): Promise<boolean> {
    const connections = { ...this.store.get('connections', {}) };
    const credentials = { ...this.store.get('encryptedCredentials', {}) };

    if (!connections[id]) {
      return false;
    }

    delete connections[id];
    delete credentials[id];

    this.store.set('connections', connections);
    this.store.set('encryptedCredentials', credentials);

    return true;
  }

  /**
   * List metadata for all saved connections without decrypting secrets.
   */
  async listConnectionMetadata(): Promise<ConnectionInfo[]> {
    const connections = this.store.get('connections', {});
    return Object.values(connections).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get metadata for a single connection.
   */
  async getConnectionMetadata(id: string): Promise<ConnectionInfo | null> {
    const connections = this.store.get('connections', {});
    return connections[id] || null;
  }

  /**
   * Update read-only setting for a connection.
   */
  async updateReadOnly(connectionId: string, readOnly: boolean): Promise<boolean> {
    const connections = this.store.get('connections', {});
    if (!connections[connectionId]) {
      return false;
    }
    connections[connectionId].readOnly = readOnly;
    this.store.set('connections', connections);
    return true;
  }

  /**
   * Check if a connection is read-only (synchronous check for IPC security boundary).
   */
  isReadOnly(connectionId: string): boolean {
    const connections = this.store.get('connections', {});
    return !!connections[connectionId]?.readOnly;
  }
}

export const credentialStore = new CredentialStore();
