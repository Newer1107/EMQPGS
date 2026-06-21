/**
 * StepUpStore — abstraction for step-up session storage.
 *
 * The interface isolates StepUpService from the storage mechanism.
 * Default: MemoryStepUpStore (in-memory Map, single-process).
 * Future: RedisStepUpStore (shared across processes/replicas).
 *
 * Business logic (StepUpService) depends ONLY on this interface.
 */
export interface StepUpEntry {
  verifiedAt: number; // Date.now()
  ttlMs: number;
  browserFingerprint?: string;
}

export interface StepUpStore {
  /** Store a verified step-up session. */
  set(key: string, entry: StepUpEntry): Promise<void> | void;

  /** Retrieve a verified step-up session, or undefined. */
  get(key: string): Promise<StepUpEntry | undefined> | (StepUpEntry | undefined);

  /** Delete a specific key. */
  delete(key: string): Promise<void> | void;

  /** Delete all keys matching a prefix. */
  deleteByPrefix(prefix: string): Promise<void> | void;

  /** Clear all entries. */
  clear(): Promise<void> | void;

  /** Iterate keys matching a prefix, returning active entries. */
  entries(prefix: string): Promise<Array<{ key: string; entry: StepUpEntry }>>;
}

/**
 * In-memory Map implementation of StepUpStore.
 * Used in development and single-process deployments.
 * ponytail: sufficient for single-process. Upgrade to Redis for multi-process.
 */
export class MemoryStepUpStore implements StepUpStore {
  private readonly store = new Map<string, StepUpEntry>();

  set(key: string, entry: StepUpEntry): void {
    this.store.set(key, entry);
    // Auto-cleanup every 100 writes
    if (this.store.size % 100 === 0) {
      this.prune();
    }
  }

  get(key: string): StepUpEntry | undefined {
    return this.store.get(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  async entries(prefix: string): Promise<Array<{ key: string; entry: StepUpEntry }>> {
    const results: Array<{ key: string; entry: StepUpEntry }> = [];
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix) && now - v.verifiedAt <= v.ttlMs) {
        results.push({ key: k, entry: v });
      }
    }
    return results;
  }

  private prune(): void {
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (now - v.verifiedAt > v.ttlMs) {
        this.store.delete(k);
      }
    }
  }
}

/** Singleton accessor */
let defaultStore: MemoryStepUpStore | null = null;
export function getDefaultStepUpStore(): MemoryStepUpStore {
  if (!defaultStore) defaultStore = new MemoryStepUpStore();
  return defaultStore;
}
