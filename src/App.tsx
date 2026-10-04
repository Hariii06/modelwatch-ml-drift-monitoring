import React, { useState, useMemo } from 'react';
import { ModelType, ScenarioType, ThresholdConfig, FeatureName } from './types/monitoring';
import { generateSyntheticDataset } from './engine/generator';
import { runDriftAnalysis, DEFAULT_THRESHOLDS } from './engine/driftEngine';
import { executeUnitTests } from './tests/driftEngine.test';

import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { SummaryCards } from './components/SummaryCards';
import { DemoScenarioControl } from './components/DemoScenarioControl';
import { FeatureTable } from './components/FeatureTable';
import { DistributionChart } from './components/DistributionChart';
import { PredictionMonitoring } from './components/PredictionMonitoring';
import { AlertPanel } from './components/AlertPanel';
import { ExperimentPanel } from './components/ExperimentPanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { StakeholderValidation } from './components/StakeholderValidation';
import { GroundTruthPanel } from './components/GroundTruthPanel';
import { MethodologyModal } from './components/MethodologyModal';
import { DemoGuideModal } from './components/DemoGuideModal';
import { LegacyAdapterModal } from './components/LegacyAdapterModal';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';

import { Sparkles, Info, ArrowRight, ShieldAlert } from 'lucide-react';

import './styles/main.css';

export const App: React.FC = () => {
  const [modelType, setModelType] = useState<ModelType>('fraud_detection');
  const [scenario, setScenario] = useState<ScenarioType>('stable');
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedFeature, setSelectedFeature] = useState<FeatureName>('transaction_amount');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  const [isLegacyAdapterOpen, setIsLegacyAdapterOpen] = useState(false);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);


  // Generate synthetic data (10k baseline, 5k current)
  const { baseline, current } = useMemo(() => {
    return generateSyntheticDataset(modelType, scenario);
  }, [modelType, scenario]);

  // Execute real statistical drift analysis pipeline
  const monitoringResult = useMemo(() => {
    return runDriftAnalysis(baseline, current, modelType, scenario, thresholds);
  }, [baseline, current, modelType, scenario, thresholds]);

  // Compute test failures count for nav badge
  const [failedTestCount, setFailedTestCount] = useState(0);
  React.useEffect(() => {
    executeUnitTests().then(res => setFailedTestCount(res.filter(t => !t.passed).length));
  }, []);

  // Selected feature metric for distribution chart
  const activeMetric = useMemo(() => {
    return monitoringResult.driftMetrics.find(m => m.featureName === selectedFeature) || monitoringResult.driftMetrics[0];
  }, [monitoringResult, selectedFeature]);

  // Run Demo preset flow: switches to Drifted scenario & highlights alert
  const handleRunDemo = () => {
    setScenario('drifted');
    setActiveTab('dashboard');
    setSelectedFeature('transaction_amount');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header Bar */}
      <Header
        selectedModel={modelType}
        onSelectModel={setModelType}
        onRunDemo={handleRunDemo}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenMethodology={() => setIsMethodologyOpen(true)}
        onOpenLegacyAdapter={() => setIsLegacyAdapterOpen(true)}
        onOpenSystemSettings={() => setIsSystemSettingsOpen(true)}
      />


      {/* Main Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        failedTestCount={failedTestCount}
      />

      {/* Main Container */}
      <ErrorBoundary>
        <main className="app-container">
          {/* Product Executive Overview Banner */}
          <div className="card product-summary-banner">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <Sparkles size={20} color="#0EA5E9" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF' }}>
                    Enterprise Production Model Monitoring
                  </h2>
                  <button
                    className="btn-demo-quick"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                    onClick={handleRunDemo}
                  >
                    Trigger Drift Scenario Demo <ArrowRight size={14} />
                  </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.35rem', lineHeight: 1.4 }}>
                  <strong>Monitoring Overview:</strong> ModelWatch performs continuous statistical Population Stability Index (PSI) and Kolmogorov-Smirnov (KS) distribution tests comparing persistent baseline populations (10,000 records) against live operational windows (5,000 records). Select scenarios below to evaluate live drift detection engines.
                </p>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* KPI Cards */}
              <SummaryCards result={monitoringResult} />

              {/* Edge Case Warnings if present */}
              {monitoringResult.missingnessWarning && (
                <div className="card" style={{ background: '#FFFBEB', borderLeft: '4px solid #F59E0B', color: '#B45309', fontSize: '0.84rem' }}>
                  <strong>{monitoringResult.missingnessWarning}</strong>
                </div>
              )}
              {monitoringResult.outlierWarning && (
                <div className="card" style={{ background: '#FFFBEB', borderLeft: '4px solid #D97706', color: '#B45309', fontSize: '0.84rem' }}>
                  <strong>{monitoringResult.outlierWarning}</strong>
                </div>
              )}

              {/* Actionable Review Alerts Panel */}
              <AlertPanel alerts={monitoringResult.alerts} thresholds={thresholds} />

              {/* Demo Scenario & Threshold Sliders Control */}
              <DemoScenarioControl
                currentScenario={scenario}
                onSelectScenario={setScenario}
                thresholds={thresholds}
                onUpdateThresholds={setThresholds}
              />

              {/* Main Feature Grid & Chart */}
              <div className="section-grid section-grid-split">
                <FeatureTable
                  driftMetrics={monitoringResult.driftMetrics}
                  selectedFeature={selectedFeature}
                  onSelectFeature={setSelectedFeature}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <DistributionChart metric={activeMetric} />
                  <PredictionMonitoring metrics={monitoringResult.predictionMetrics} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ground_truth' && (
            <GroundTruthPanel currentPredictions={current} />
          )}

          {activeTab === 'experiment' && (
            <ExperimentPanel modelType={modelType} thresholds={thresholds} />
          )}

          {activeTab === 'diagnostics' && (
            <DiagnosticsPanel />
          )}

          {activeTab === 'validation' && (
            <StakeholderValidation />
          )}
        </main>
      </ErrorBoundary>


      {/* Modals */}
      <MethodologyModal isOpen={isMethodologyOpen} onClose={() => setIsMethodologyOpen(false)} />
      <DemoGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <LegacyAdapterModal isOpen={isLegacyAdapterOpen} onClose={() => setIsLegacyAdapterOpen(false)} />
      <SystemSettingsModal
        isOpen={isSystemSettingsOpen}
        onClose={() => setIsSystemSettingsOpen(false)}
        currentThresholds={thresholds}
        onUpdateThresholds={setThresholds}
        monitoringResult={monitoringResult}
      />


      {/* Footer */}
      <footer style={{ marginTop: 'auto', background: 'var(--navy-900)', borderTop: '1px solid var(--navy-700)', color: '#94A3B8', padding: '1rem 1.75rem', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>ModelWatch</strong> &bull; Enterprise ML Drift Monitoring System
        </div>
        <div>
          Synthetic Banking Dataset (10,000 Baseline / 5,000 Current) &bull; Production Statistical Engine
        </div>
      </footer>
    </div>
  );
};
