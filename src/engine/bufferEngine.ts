import { Observation, BufferedBatch, BufferQueueState } from '../types/monitoring';

const STORAGE_KEY = 'modelwatch_store_and_forward_v1';
const DEFAULT_MAX_CAPACITY = 10;

/**
 * Client-side Store-and-Forward Buffering Engine
 * Manages FIFO queueing of unconfirmed prediction batches with retry, flush,
 * and resilient localStorage persistence fallback.
 */
export class StoreAndForwardBuffer {
  private queue: BufferedBatch[] = [];
  private maxCapacity: number;
  private isStorageAvailable: boolean = true;

  constructor(maxCapacity: number = DEFAULT_MAX_CAPACITY, initialBatches?: BufferedBatch[]) {
    this.maxCapacity = maxCapacity;
    if (initialBatches) {
      this.queue = initialBatches;
    } else {
      this.loadFromStorage();
    }
  }

  /**
   * Enqueues a new prediction batch into FIFO queue
   */
  public enqueueBatch(observations: Observation[], customBatchId?: string): BufferedBatch {
    if (!observations || observations.length === 0) {
      throw new Error('Cannot enqueue empty observation batch.');
    }

    const batchId = customBatchId || `batch_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const batch: BufferedBatch = {
      batch_id: batchId,
      observations: [...observations],
      ingested_at: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
      batch_size: observations.length
    };

    // FIFO Capacity Limit Enforcement
    while (this.queue.length >= this.maxCapacity) {
      // Prefer evicting processed batches first
      const processedIdx = this.queue.findIndex(b => b.status === 'processed');
      if (processedIdx !== -1) {
        this.queue.splice(processedIdx, 1);
      } else {
        // Drop oldest item FIFO
        this.queue.shift();
      }
    }

    this.queue.push(batch);
    this.saveToStorage();
    return batch;
  }

  /**
   * Returns copy of active queue
   */
  public getQueue(): BufferedBatch[] {
    return this.queue.map(b => ({ ...b }));
  }

  /**
   * Returns snapshot statistics of queue health
   */
  public getQueueState(): BufferQueueState {
    const pendingCount = this.queue.filter(b => b.status === 'pending' || b.status === 'retrying').length;
    const failedCount = this.queue.filter(b => b.status === 'failed').length;
    const processedCount = this.queue.filter(b => b.status === 'processed').length;
    const totalBufferedRecords = this.queue.reduce((acc, b) => acc + b.batch_size, 0);

    return {
      batches: this.getQueue(),
      pendingCount,
      failedCount,
      processedCount,
      totalBufferedRecords,
      maxCapacity: this.maxCapacity
    };
  }

  /**
   * Simulates deterministic ingestion attempt (success vs HTTP 503 failure)
   */
  public simulateIngestion(batchId: string, shouldFail: boolean): BufferedBatch | null {
    const batch = this.queue.find(b => b.batch_id === batchId);
    if (!batch) return null;

    batch.last_attempt_at = new Date().toISOString();

    if (shouldFail) {
      batch.status = 'failed';
      batch.retry_count += 1;
      batch.error = `Ingestion endpoint failure HTTP 503 (Attempt #${batch.retry_count}).`;
    } else {
      batch.status = 'processed';
      batch.error = undefined;
    }

    this.saveToStorage();
    return { ...batch };
  }

  /**
   * Retries all failed batches in queue
   */
  public retryFailedBatches(): BufferedBatch[] {
    const retried: BufferedBatch[] = [];
    this.queue.forEach(batch => {
      if (batch.status === 'failed') {
        batch.status = 'retrying';
        batch.last_attempt_at = new Date().toISOString();
        retried.push({ ...batch });
      }
    });
    this.saveToStorage();
    return retried;
  }

  /**
   * Flushes all successfully processed batches from queue
   */
  public flushProcessed(): number {
    const initialCount = this.queue.length;
    this.queue = this.queue.filter(b => b.status !== 'processed');
    const flushedCount = initialCount - this.queue.length;
    this.saveToStorage();
    return flushedCount;
  }

  /**
   * Clears all batches from queue
   */
  public clearQueue(): void {
    this.queue = [];
    this.saveToStorage();
  }

  /**
   * Returns capacity limit
   */
  public getMaxCapacity(): number {
    return this.maxCapacity;
  }

  /**
   * Safely loads queue state from localStorage
   */
  private loadFromStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        this.isStorageAvailable = false;
        return;
      }
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) {
          this.queue = parsed;
        }
      }
    } catch {
      this.isStorageAvailable = false;
    }
  }

  /**
   * Safely persists queue state to localStorage
   */
  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage && this.isStorageAvailable) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
      }
    } catch {
      // Storage quota exceeded or disabled - fail silently to memory fallback
      this.isStorageAvailable = false;
    }
  }
}
