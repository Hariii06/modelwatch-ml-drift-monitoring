import {
  Observation,
  ModelType,
  ScenarioType,
  ThresholdConfig,
  MonitoringResult
} from '../types/monitoring';

export interface BaselineEntity {
  id: string;
  name: string;
  modelType: ModelType;
  observations: Observation[];
  createdAt: string;
}

export interface MonitoringHistoryEntity {
  id: string;
  timestamp: string;
  modelType: ModelType;
  scenario: ScenarioType;
  overallStatus: string;
  driftedFeaturesCount: number;
  result: MonitoringResult;
}

export interface BufferedBatchEntity {
  batchId: string;
  recordCount: number;
  status: string;
  ingestedAt: string;
}

export interface OutcomeEntity {
  outcomeId: string;
  recordId: string;
  actualLabel: number;
  timestamp: string;
}

export interface StorageTelemetry {
  isLocalStorageAvailable: boolean;
  storageMode: 'localStorage' | 'memory';
  storageNamespace: string;
  historyCount: number;
  hasCustomBaseline: boolean;
  hasThresholdOverrides: boolean;
  storageUsedBytes: number;
}

const STORAGE_PREFIX = 'modelwatch_storage_v1_';
const KEYS = {
  BASELINE: `${STORAGE_PREFIX}baseline`,
  THRESHOLDS: `${STORAGE_PREFIX}thresholds`,
  HISTORY: `${STORAGE_PREFIX}history`
};

const MAX_HISTORY_LIMIT = 20; // Bounded retention policy

/**
 * Centralized, namespaced client-side persistence manager.
 * Backed by browser localStorage with safe in-memory fallback.
 */
export class PersistenceManager {
  private inMemoryStorage: Map<string, string> = new Map();
  private isStorageAvailable: boolean = true;

  constructor() {
    this.checkStorageAvailability();
  }

  private checkStorageAvailability(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        this.isStorageAvailable = false;
        return;
      }
      const testKey = `${STORAGE_PREFIX}test_ping`;
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      this.isStorageAvailable = true;
    } catch {
      this.isStorageAvailable = false;
    }
  }

  private getItem(key: string): string | null {
    try {
      if (this.isStorageAvailable && typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return this.inMemoryStorage.get(key) || null;
    } catch {
      return this.inMemoryStorage.get(key) || null;
    }
  }

  private setItem(key: string, value: string): boolean {
    this.inMemoryStorage.set(key, value);
    try {
      if (this.isStorageAvailable && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch {
      this.isStorageAvailable = false;
    }
    return false;
  }

  private removeItem(key: string): void {
    this.inMemoryStorage.delete(key);
    try {
      if (this.isStorageAvailable && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Storage error ignored
    }
  }

  // --- Baseline Persistence ---
  public saveBaseline(entity: BaselineEntity): boolean {
    if (!entity || !entity.modelType || !Array.isArray(entity.observations)) return false;
    return this.setItem(`${KEYS.BASELINE}_${entity.modelType}`, JSON.stringify(entity));
  }

  public getBaseline(modelType: ModelType): BaselineEntity | null {
    const raw = this.getItem(`${KEYS.BASELINE}_${modelType}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.observations)) {
        return parsed as BaselineEntity;
      }
    } catch {
      // Corrupted JSON fallback
    }
    return null;
  }

  // --- Threshold Overrides ---
  public saveThresholdOverrides(thresholds: ThresholdConfig): boolean {
    if (!thresholds) return false;
    return this.setItem(KEYS.THRESHOLDS, JSON.stringify(thresholds));
  }

  public getThresholdOverrides(): ThresholdConfig | null {
    const raw = this.getItem(KEYS.THRESHOLDS);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ThresholdConfig;
    } catch {
      return null;
    }
  }

  public loadThresholdOverrides(): ThresholdConfig | null {
    return this.getThresholdOverrides();
  }

  // --- Monitoring Execution History (Bounded Retention) ---
  public appendMonitoringHistory(result: MonitoringResult, scenario: ScenarioType): boolean {
    if (!result) return false;

    const history = this.getMonitoringHistory(MAX_HISTORY_LIMIT);
    const newEntry: MonitoringHistoryEntity = {
      id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      modelType: result.modelType,
      scenario,
      overallStatus: result.overallStatus,
      driftedFeaturesCount: result.featuresWithDrift,
      result
    };

    history.unshift(newEntry);

    // Enforce max capacity (bounded policy)
    const boundedHistory = history.slice(0, MAX_HISTORY_LIMIT);
    return this.setItem(KEYS.HISTORY, JSON.stringify(boundedHistory));
  }

  public getMonitoringHistory(limit = MAX_HISTORY_LIMIT): MonitoringHistoryEntity[] {
    const raw = this.getItem(KEYS.HISTORY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, limit);
      }
    } catch {
      // Corrupted storage safety
    }
    return [];
  }

  // --- JSON Report Export Serialization ---
  public exportReportJson(result?: MonitoringResult, history?: MonitoringHistoryEntity[]): string {
    const reportObj = {
      reportMetadata: {
        system: 'ModelWatch Enterprise ML Drift Monitoring',
        exportedAt: new Date().toISOString(),
        version: 'v1.0.0',
        environment: 'Client-Side Ingestion & Statistical Engine'
      },
      currentMonitoringResult: result || null,
      executionHistorySummary: (history || this.getMonitoringHistory(5)).map(h => ({
        id: h.id,
        timestamp: h.timestamp,
        modelType: h.modelType,
        scenario: h.scenario,
        overallStatus: h.overallStatus,
        driftedFeatures: h.driftedFeaturesCount
      })),
      storageTelemetry: this.getStorageTelemetry()
    };

    return JSON.stringify(reportObj, null, 2);
  }

  // --- Storage Clear & Telemetry ---
  public clearPersistentData(): void {
    const keysToRemove = [
      `${KEYS.BASELINE}_fraud_detection`,
      `${KEYS.BASELINE}_service_prioritisation`,
      KEYS.THRESHOLDS,
      KEYS.HISTORY
    ];

    keysToRemove.forEach(k => this.removeItem(k));
  }

  public clearAllPersistentData(): void {
    this.clearPersistentData();
  }

  public getStorageTelemetry(): StorageTelemetry {
    const history = this.getMonitoringHistory();
    const hasBaseline = Boolean(this.getBaseline('fraud_detection') || this.getBaseline('service_prioritisation'));
    const hasThresholds = Boolean(this.getThresholdOverrides());

    let storageUsedBytes = 0;
    try {
      if (this.isStorageAvailable && typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(STORAGE_PREFIX)) {
            const val = window.localStorage.getItem(key);
            storageUsedBytes += (key.length + (val ? val.length : 0)) * 2; // UTF-16 approx
          }
        }
      }
    } catch {
      storageUsedBytes = 0;
    }

    return {
      isLocalStorageAvailable: this.isStorageAvailable,
      storageMode: this.isStorageAvailable ? 'localStorage' : 'memory',
      storageNamespace: STORAGE_PREFIX,
      historyCount: history.length,
      hasCustomBaseline: hasBaseline,
      hasThresholdOverrides: hasThresholds,
      storageUsedBytes
    };
  }
}

