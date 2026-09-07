import Store from 'electron-store';
import crypto from 'crypto';
import { SavedQuery, SaveQueryRequest } from '@shared/ipc-types';

interface SavedQuerySchema {
  queries: Record<string, SavedQuery>;
}

const StoreConstructor = ((Store as unknown as { default?: typeof Store }).default || Store) as typeof Store;

class SavedQueryStore {
  private _store: Store<SavedQuerySchema> | null = null;

  private get store(): Store<SavedQuerySchema> {
    if (!this._store) {
      this._store = new StoreConstructor<SavedQuerySchema>({
        name: 'fired-saved-queries',
        defaults: {
          queries: {},
        },
      });

      // Seamless migration from legacy firefoo-saved-queries
      try {
        const legacyStore = new StoreConstructor<SavedQuerySchema>({ name: 'firefoo-saved-queries' });
        const legacyQueries = legacyStore.get('queries') || {};
        const currentQueries = this._store.get('queries') || {};

        if (Object.keys(currentQueries).length === 0 && Object.keys(legacyQueries).length > 0) {
          this._store.set('queries', legacyQueries);
        }
      } catch {
        // Ignore if legacy store doesn't exist
      }
    }
    return this._store;
  }

  async listQueries(collectionPath?: string): Promise<SavedQuery[]> {
    const queries = this.store.get('queries', {});
    const list = Object.values(queries);

    if (collectionPath) {
      return list
        .filter((q) => !q.collectionPath || q.collectionPath === collectionPath)
        .sort((a, b) => b.createdAt - a.createdAt);
    }

    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  async saveQuery(req: SaveQueryRequest): Promise<SavedQuery> {
    const id = crypto.randomUUID();
    const query: SavedQuery = {
      id,
      name: req.name.trim(),
      connectionId: req.connectionId,
      collectionPath: req.collectionPath,
      where: req.where,
      orderBy: req.orderBy,
      createdAt: Date.now(),
    };

    const queries = this.store.get('queries', {});
    queries[id] = query;
    this.store.set('queries', queries);

    return query;
  }

  async deleteQuery(id: string): Promise<boolean> {
    const queries = this.store.get('queries', {});
    if (!(id in queries)) {
      return false;
    }
    delete queries[id];
    this.store.set('queries', queries);
    return true;
  }
}

export const savedQueryStore = new SavedQueryStore();
