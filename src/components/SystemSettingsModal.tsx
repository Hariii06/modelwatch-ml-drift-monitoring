import React, { useState, useEffect } from 'react';
import { ThresholdConfig, MonitoringResult } from '../types/monitoring';
import { DEFAULT_THRESHOLDS } from '../engine/driftEngine';
import { PersistenceManager, StorageTelemetry } from '../engine/persistenceManager';
import { Settings, Download, Trash2, Database, ShieldCheck, X, Check, AlertTriangle, Code, HardDrive, RefreshCw } from 'lucide-react';

export interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThresholds: ThresholdConfig;
  onUpdateThresholds: (thresholds: ThresholdConfig) => void;
  monitoringResult?: MonitoringResult;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  isOpen,
  onClose,
  currentThresholds,
  onUpdateThresholds,
  monitoringResult
}) => {
  const [activeTab, setActiveTab] = useState<'thresholds' | 'telemetry' | 'export' | 'openapi'>('thresholds');
  
  // Threshold Overrides State
  const [psiWarning, setPsiWarning] = useState<number>(currentThresholds.psiWarning);
  const [psiCritical, setPsiCritical] = useState<number>(currentThresholds.psiCritical);
  const [ksPValue, setKsPValue] = useState<number>(currentThresholds.ksPValueThreshold);
  const [rateShift, setRateShift] = useState<number>(currentThresholds.predictionRateWarningDelta);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Persistence Manager & Telemetry State
  const persistenceManager = React.useMemo(() => new PersistenceManager(), []);
  const [telemetry, setTelemetry] = useState<StorageTelemetry>(() => persistenceManager.getStorageTelemetry());
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Sync state when props change
  useEffect(() => {
    setPsiWarning(currentThresholds.psiWarning);
    setPsiCritical(currentThresholds.psiCritical);
    setKsPValue(currentThresholds.ksPValueThreshold);
    setRateShift(currentThresholds.predictionRateWarningDelta);
  }, [currentThresholds]);

  // Handle ESC key dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Refresh storage telemetry
  const refreshTelemetry = () => {
    setTelemetry(persistenceManager.getStorageTelemetry());
  };

  // Handle saving threshold overrides to persistence
  const handleSaveThresholds = () => {
    const updated: ThresholdConfig = {
      psiWarning: Number(psiWarning),
      psiCritical: Number(psiCritical),
      ksPValueThreshold: Number(ksPValue),
      predictionRateWarningDelta: Number(rateShift)
    };
    
    persistenceManager.saveThresholdOverrides(updated);
    onUpdateThresholds(updated);
    setSaveStatus('Threshold overrides persisted to storage successfully.');
    refreshTelemetry();
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Handle reset thresholds to default values
  const handleResetThresholds = () => {
    setPsiWarning(DEFAULT_THRESHOLDS.psiWarning);
    setPsiCritical(DEFAULT_THRESHOLDS.psiCritical);
    setKsPValue(DEFAULT_THRESHOLDS.ksPValueThreshold);
    setRateShift(DEFAULT_THRESHOLDS.predictionRateWarningDelta);

    persistenceManager.saveThresholdOverrides(DEFAULT_THRESHOLDS);
    onUpdateThresholds(DEFAULT_THRESHOLDS);
    setSaveStatus('Thresholds reset to default factory parameters.');
    refreshTelemetry();
    setTimeout(() => setSaveStatus(null), 3000);
  };


  // Handle JSON report export download
  const handleExportJson = () => {
    try {
      const jsonStr = persistenceManager.exportReportJson(monitoringResult);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `modelwatch-report-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setActionNotice(`Report exported successfully (${blob.size} bytes downloaded).`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`Export failed: ${err?.message || 'Unknown error'}`);
    }
  };

  // Handle clearing persistent storage
  const handleClearPersistentData = () => {
    persistenceManager.clearAllPersistentData();
    setShowClearConfirm(false);
    refreshTelemetry();
    setActionNotice('All ModelWatch persistent data cleared successfully.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(2, 6, 23, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
    >
      <div 
        className="modal-container"
        style={{
          background: '#0F172A',
          border: '1px solid #334155',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          color: '#F8FAFC'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#182234'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'rgba(14, 165, 233, 0.15)',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              borderRadius: '0.5rem',
              padding: '0.5rem',
              color: '#0EA5E9',
              display: 'flex'
            }}>
              <Settings size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' }}>
                System Settings & Management
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
                Threshold configuration, storage telemetry, JSON report export, and OpenAPI specifications
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close Settings Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #1E293B',
          background: '#0F172A',
          padding: '0 1.5rem'
        }}>
          {[
            { id: 'thresholds', label: 'Threshold Overrides', icon: Settings },
            { id: 'telemetry', label: 'Storage & Telemetry', icon: HardDrive },
            { id: 'export', label: 'JSON Report Export', icon: Download },
            { id: 'openapi', label: 'OpenAPI Spec', icon: Code }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.85rem 1.1rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #0EA5E9' : '2px solid transparent',
                  color: isActive ? '#0EA5E9' : '#94A3B8',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Action Notice Alert */}
          {actionNotice && (
            <div style={{
              background: 'rgba(14, 165, 233, 0.15)',
              border: '1px solid #0EA5E9',
              borderRadius: '0.375rem',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.82rem',
              color: '#38BDF8',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Check size={16} />
              {actionNotice}
            </div>
          )}

          {/* TAB 1: THRESHOLD OVERRIDES */}
          {activeTab === 'thresholds' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.5 }}>
                Configure continuous statistical thresholds used by the drift evaluator engine. Overrides are safely persisted to client-side storage (`modelwatch_storage_v1_`).
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#1E293B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '0.35rem' }}>
                    PSI Warning Threshold (Moderate Shift)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="0.50"
                    value={psiWarning}
                    onChange={(e) => setPsiWarning(parseFloat(e.target.value) || 0.10)}
                    style={{ width: '100%', padding: '0.5rem', background: '#0F172A', border: '1px solid #475569', borderRadius: '0.25rem', color: '#FFF' }}
                  />
                  <span style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: '0.35rem', display: 'block' }}>
                    Default: 0.10. Triggers Amber warning status.
                  </span>
                </div>

                <div style={{ background: '#1E293B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '0.35rem' }}>
                    PSI Critical Threshold (Significant Shift)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.05"
                    max="1.00"
                    value={psiCritical}
                    onChange={(e) => setPsiCritical(parseFloat(e.target.value) || 0.20)}
                    style={{ width: '100%', padding: '0.5rem', background: '#0F172A', border: '1px solid #475569', borderRadius: '0.25rem', color: '#FFF' }}
                  />
                  <span style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: '0.35rem', display: 'block' }}>
                    Default: 0.20. Triggers Red alert and "Review Recommended".
                  </span>
                </div>

                <div style={{ background: '#1E293B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '0.35rem' }}>
                    KS Test p-Value Threshold
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.001"
                    max="0.20"
                    value={ksPValue}
                    onChange={(e) => setKsPValue(parseFloat(e.target.value) || 0.05)}
                    style={{ width: '100%', padding: '0.5rem', background: '#0F172A', border: '1px solid #475569', borderRadius: '0.25rem', color: '#FFF' }}
                  />
                  <span style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: '0.35rem', display: 'block' }}>
                    Default: 0.05 (95% confidence significance level).
                  </span>
                </div>

                <div style={{ background: '#1E293B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '0.35rem' }}>
                    Prediction Rate Shift Threshold
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="0.50"
                    value={rateShift}
                    onChange={(e) => setRateShift(parseFloat(e.target.value) || 0.05)}
                    style={{ width: '100%', padding: '0.5rem', background: '#0F172A', border: '1px solid #475569', borderRadius: '0.25rem', color: '#FFF' }}
                  />
                  <span style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: '0.35rem', display: 'block' }}>
                    Default: 0.05 (5% positive classification rate shift).
                  </span>
                </div>
              </div>

              {saveStatus && (
                <div style={{ color: '#10B981', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Check size={16} /> {saveStatus}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  onClick={handleSaveThresholds}
                  style={{
                    background: '#2563EB',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '0.375rem',
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Check size={16} /> Save Threshold Overrides
                </button>

                <button
                  onClick={handleResetThresholds}
                  style={{
                    background: '#334155',
                    color: '#F8FAFC',
                    border: '1px solid #475569',
                    borderRadius: '0.375rem',
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <RefreshCw size={14} /> Reset Defaults
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: STORAGE TELEMETRY & DATA MANAGEMENT */}
          {activeTab === 'telemetry' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ fontSize: '0.84rem', color: '#94A3B8' }}>
                Real-time storage telemetry and persistent state diagnostics managed by `PersistenceManager`.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#1E293B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>STORAGE MODE</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38BDF8', marginTop: '0.25rem' }}>
                    {telemetry.storageMode === 'localStorage' ? 'Browser LocalStorage' : 'In-Memory Fallback'}
                  </div>
                </div>

                <div style={{ background: '#1E293B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>PERSISTENCE AVAILABILITY</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: telemetry.isLocalStorageAvailable ? '#10B981' : '#F59E0B', marginTop: '0.25rem' }}>
                    {telemetry.isLocalStorageAvailable ? 'Available & Active' : 'Restricted (Fallback Active)'}
                  </div>
                </div>

                <div style={{ background: '#1E293B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>MONITORING HISTORY ENTRIES</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC', marginTop: '0.25rem' }}>
                    {telemetry.historyCount} / 20 (FIFO Limit)
                  </div>
                </div>

                <div style={{ background: '#1E293B', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>STORAGE NAMESPACE</div>
                  <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 600, color: '#A7F3D0', marginTop: '0.35rem' }}>
                    {telemetry.storageNamespace}
                  </div>
                </div>
              </div>

              {/* Clear Storage Section */}
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1.25rem', borderRadius: '0.5rem', marginTop: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={18} /> Destructive Storage Action
                </h4>
                <p style={{ margin: '0.35rem 0 1rem 0', fontSize: '0.8rem', color: '#CBD5E1' }}>
                  Clearing persistent storage will delete saved baseline datasets, custom threshold overrides, and execution history logs stored under the `{telemetry.storageNamespace}` namespace.
                </p>

                {!showClearConfirm ? (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    style={{
                      background: '#DC2626',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 1rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Trash2 size={15} /> Clear Persistent Data...
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FCA5A5' }}>
                      Confirm clearing ModelWatch persistent data?
                    </span>
                    <button
                      onClick={handleClearPersistentData}
                      style={{
                        background: '#DC2626',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '0.375rem',
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Yes, Clear Data
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      style={{
                        background: '#334155',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '0.375rem',
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: JSON REPORT EXPORT */}
          {activeTab === 'export' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.5 }}>
                Generate and download a comprehensive, structured JSON report containing current monitoring results, feature PSI/KS metrics, ground-truth performance evaluation, active review alerts, and execution metadata for compliance auditing.
              </div>

              <div style={{ background: '#1E293B', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#FFF' }}>
                  Report Serialization Payload Structure
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#CBD5E1', lineHeight: 1.6 }}>
                  <li><strong>reportMetadata:</strong> System name, export timestamp, environment status.</li>
                  <li><strong>currentMonitoringResult:</strong> Overall drift status, feature metrics (PSI/KS), prediction drift, actionable alerts.</li>
                  <li><strong>monitoringHistory:</strong> Up to 20 past bounded execution records.</li>
                  <li><strong>storageTelemetry:</strong> Local persistence status snapshot.</li>
                </ul>
              </div>

              <button
                onClick={handleExportJson}
                style={{
                  background: '#10B981',
                  color: '#064E3B',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  alignSelf: 'flex-start'
                }}
              >
                <Download size={18} /> Export JSON Report (`modelwatch-report.json`)
              </button>
            </div>
          )}

          {/* TAB 4: OPENAPI SPEC PREVIEW */}
          {activeTab === 'openapi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.3)', padding: '0.75rem 1rem', borderRadius: '0.375rem', fontSize: '0.8rem', color: '#38BDF8' }}>
                <strong>Client-Side Mock REST API Contract:</strong> OpenAPI 3.0 specification preview implemented in `src/engine/ingestionService.ts`.
              </div>

              <div style={{ background: '#020617', border: '1px solid #334155', borderRadius: '0.5rem', padding: '1.25rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#E2E8F0', overflowX: 'auto', maxHeight: '350px' }}>
                <div style={{ color: '#38BDF8', fontWeight: 700, marginBottom: '0.5rem' }}>
                  POST /api/v1/predict
                </div>
                <div style={{ color: '#94A3B8', marginBottom: '0.5rem' }}>
                  Header: X-ModelWatch-Version: v1.0.0 | Content-Type: application/json
                </div>
                <pre style={{ margin: '0 0 1rem 0', color: '#A7F3D0' }}>
{`// Request Payload: ApiIngestionEnvelope
{
  "version": "v1_legacy" | "v2_modern",
  "records": [
    { "record_id": "rec_001", "tx_amt": 250.75, "user_risk": 65, "score": 0.85 }
  ]
}

// Responses:
// 200 OK: { status: 200, success: true, data: { transformedCount: 1 } }
// 400 Bad Request: { status: 400, success: false, error: { code: "BAD_REQUEST" } }
// 422 Unprocessable Entity: { status: 422, success: false, error: { code: "UNPROCESSABLE_ENTITY" } }
// 503 Service Unavailable: { status: 503, success: false, error: { code: "SERVICE_UNAVAILABLE" } }`}
                </pre>

                <div style={{ color: '#38BDF8', fontWeight: 700, marginBottom: '0.5rem' }}>
                  POST /api/v1/outcomes
                </div>
                <pre style={{ margin: '0 0 1rem 0', color: '#A7F3D0' }}>
{`// Request Payload: GroundTruthOutcome[]
[
  { "record_id": "rec_001", "actual_label": 1, "outcome_timestamp": "2026-09-10T10:00:00Z" }
]

// Responses: 200 OK, 400 Bad Request, 422 Unprocessable Entity, 503 Service Unavailable`}
                </pre>

                <div style={{ color: '#38BDF8', fontWeight: 700, marginBottom: '0.5rem' }}>
                  GET /api/v1/health
                </div>
                <pre style={{ margin: 0, color: '#A7F3D0' }}>
{`// Response: 200 OK
{
  "status": 200,
  "success": true,
  "data": { "status": "healthy", "version": "v1.0.0", "storage": Telemetry }
}`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #1E293B',
          background: '#182234',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
            ModelWatch v1.0.0 &bull; Local Storage Namespace: <code style={{ color: '#38BDF8' }}>{telemetry.storageNamespace}</code>
          </span>
          <button
            onClick={onClose}
            style={{
              background: '#334155',
              color: '#FFF',
              border: '1px solid #475569',
              borderRadius: '0.375rem',
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
