import React, { useState, useEffect } from 'react';
import { executeUnitTests } from '../tests/driftEngine.test';
import { TestCaseResult } from '../types/monitoring';
import { CheckCircle2, XCircle, Play, ShieldCheck, Terminal } from 'lucide-react';

export const DiagnosticsPanel: React.FC = () => {
  const [tests, setTests] = useState<TestCaseResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const results = executeUnitTests();
      setTests(results);
      setIsRunning(false);
    }, 150);
  };

  useEffect(() => {
    runTests();
  }, []);

  const passedCount = tests.filter(t => t.passed).length;
  const failedCount = tests.filter(t => !t.passed).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={20} color="var(--accent-blue)" />
            Automated Diagnostic & Statistical Engine Test Suite
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--navy-600)' }}>
            Real-time execution of mathematical assertions, statistical boundary tests, and edge case resilience verifications.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className="badge-status badge-green" style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}>
              <CheckCircle2 size={13} /> {passedCount} PASSED
            </span>
            {failedCount > 0 && (
              <span className="badge-status badge-red" style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}>
                <XCircle size={13} /> {failedCount} FAILED
              </span>
            )}
          </div>

          <button className="btn-demo-quick" onClick={runTests} disabled={isRunning}>
            <Play size={15} fill="white" /> {isRunning ? 'Running...' : 'Re-run Tests'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {tests.map((test) => (
          <div
            key={test.id}
            className="test-item"
            style={{ borderLeft: `4px solid ${test.passed ? '#10B981' : '#EF4444'}` }}
          >
            <div className="test-item-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {test.passed ? <CheckCircle2 size={18} color="#10B981" /> : <XCircle size={18} color="#EF4444" />}
                <span className="test-title">{test.name}</span>
                <span style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                  [{test.id}]
                </span>
              </div>

              <span className={`badge-status ${test.passed ? 'badge-green' : 'badge-red'}`}>
                {test.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--navy-700)' }}>
              {test.description}
            </p>

            <div style={{ background: '#F8FAFC', padding: '0.6rem 0.85rem', borderRadius: 6, fontSize: '0.78rem', border: '1px solid #E2E8F0' }}>
              <strong>Verification Result:</strong> {test.details}
            </div>

            {test.logs.length > 0 && (
              <div style={{ background: '#0F172A', color: '#38BDF8', padding: '0.5rem 0.85rem', borderRadius: 6, fontSize: '0.72rem', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                <Terminal size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  {test.logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
