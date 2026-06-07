import React, { useState, useEffect } from 'react';
import { ChevronLeft, Save, ShieldCheck, AlertTriangle, Eye, Sparkles, Layers } from 'lucide-react';
import { validateFormFields } from '../utils/validations';

export default function ReviewPanel({ uploadId, allUploads, onBack, onSaveSuccess }) {
  const [record, setRecord] = useState(null);
  const [rows, setRows] = useState([]);
  const [activeRowIdx, setActiveRowIdx] = useState(0);
  const [localErrors, setLocalErrors] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Fetch record on mount
  useEffect(() => {
    async function loadRecord() {
      try {
        const response = await fetch(`/api/uploads/${uploadId}`);
        if (!response.ok) throw new Error('Failed to load upload record');
        const data = await response.json();
        setRecord(data);
        
        // Populate local rows state with extracted data list
        if (data.extractedData && Array.isArray(data.extractedData.rows)) {
          setRows(data.extractedData.rows);
        } else {
          setRows([]);
        }
      } catch (err) {
        setApiError(err.message);
      }
    }
    loadRecord();
  }, [uploadId]);

  // Run live validations on rows change
  useEffect(() => {
    if (rows.length > 0) {
      const errs = validateFormFields({ rows }, allUploads, uploadId);
      setLocalErrors(errs);
    } else {
      setLocalErrors([]);
    }
  }, [rows, allUploads, uploadId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setRows(prevRows => {
      const newRows = [...prevRows];
      const currentField = newRows[activeRowIdx][name];
      if (typeof currentField === 'object' && currentField !== null) {
        newRows[activeRowIdx][name] = { ...currentField, value };
      } else {
        newRows[activeRowIdx][name] = { value, confidence: 1.0 };
      }
      return newRows;
    });
  };

  const handleSave = async (markReviewed) => {
    setSaveLoading(true);
    setApiError(null);
    try {
      const response = await fetch(`/api/uploads/${uploadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows,
          markReviewed
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save changes');
      }

      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const getFieldValue = (field) => {
    if (field && typeof field === 'object' && field.value !== undefined) {
      return field.value;
    }
    return field || '';
  };

  // Helper to resolve confidence styling for active row
  const getConfidenceInfo = (fieldKey) => {
    const activeRow = rows[activeRowIdx];
    if (!activeRow) return { label: 'Unrated', colorClass: 'opacity-60' };
    const fieldObj = activeRow[fieldKey];
    
    // Support both nested object and flat properties (old style: activeRow[`${fieldKey}_confidence`])
    const confVal = (fieldObj && typeof fieldObj === 'object' && fieldObj.confidence !== undefined)
      ? fieldObj.confidence
      : activeRow[`${fieldKey}_confidence`];

    if (confVal === undefined) return { label: 'Manual Input', colorClass: 'opacity-60' };

    const percentage = Math.round(confVal * 100);
    const reason = (fieldObj && typeof fieldObj === 'object') ? fieldObj.reason : null;

    if (confVal >= 0.85) {
      return { label: `AI: ${percentage}%`, colorClass: 'high', reason };
    } else if (confVal >= 0.70) {
      return { label: `AI: ${percentage}%`, colorClass: 'med', reason };
    } else {
      return { label: `AI: ${percentage}%`, colorClass: 'low', reason };
    }
  };

  // Helper to check if a specific row has any validation errors
  const rowHasError = (idx) => {
    return localErrors.some(e => e.rowIdx === idx);
  };

  if (apiError && !record) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
        <h3 className="text-error" style={{ marginBottom: '16px' }}>Error Loading Record</h3>
        <p>{apiError}</p>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginTop: '16px' }}>
          Go Back
        </button>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex-center" style={{ height: '300px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (record.status === 'Processing') {
    return (
      <div className="flex-center" style={{ height: '300px', flexDirection: 'column', gap: '16px' }}>
        <div className="spinner"></div>
        <p style={{ color: 'var(--text-muted)' }}>AI is reading operational sheet...</p>
      </div>
    );
  }

  if (rows.length === 0 && record.status !== 'Failed') {
    return (
      <div className="glass-panel text-center" style={{ padding: '32px', maxWidth: '500px', margin: '40px auto' }}>
        <h3 style={{ marginBottom: '16px', color: 'white' }}>No Data Extracted</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>This document contains no written operational logs rows.</p>
        <button onClick={onBack} className="btn btn-secondary">
          Back to List
        </button>
      </div>
    );
  }

  const isPdf = record.mimeType === 'application/pdf';
  const docUrl = record.filePath;
  const currentFields = rows[activeRowIdx] || {};

  return (
    <div className="review-container">
      {/* LEFT PANE: Document Viewer */}
      <div className="document-pane glass-panel">
        <div className="pane-header">
          <button onClick={onBack} className="btn btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ChevronLeft size={16} /> Back to List
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }} title={record.fileName}>
            {record.fileName}
          </span>
          <span className={`badge ${record.status === 'Reviewed' ? 'success' : record.status === 'Failed' ? 'error' : 'warning'}`}>
            {record.status}
          </span>
        </div>

        <div className="viewer-content">
          {isPdf ? (
            <iframe 
              src={`${docUrl}#toolbar=0`}
              className="iframe-viewer"
              title="Document Preview"
            />
          ) : (
            <img 
              src={docUrl} 
              alt="Handwritten Log Sheet" 
              className="preview-img"
            />
          )}
        </div>
      </div>

      {record.status === 'Failed' ? (
        /* RIGHT PANE: Extraction Failure Card */
        <div className="form-pane glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="pane-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-error)', fontSize: '1.1rem' }}>
              <AlertTriangle size={18} /> Extraction Failed
            </h3>
          </div>
          
          <div className="form-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: '40px 24px', textAlign: 'center', gap: '20px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '50%', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={48} className="text-error" />
            </div>
            <h4 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 600 }}>Unrelated Document Format</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5', maxWidth: '320px' }}>
              {record.validationErrors?.[0]?.message || 'We could not process this document. Please verify the file is a valid operational log sheet and is fully legible.'}
            </p>
            <button onClick={onBack} className="btn btn-secondary" style={{ marginTop: '10px' }}>
              Back to Audit Logs
            </button>
          </div>
        </div>
      ) : (
        /* RIGHT PANE: Review Form */
        <div className="form-pane glass-panel">
        <div className="pane-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', fontSize: '1.1rem' }}>
            <Eye size={18} className="text-cyan" /> Verify Table Records ({rows.length} rows)
          </h3>
          {record.extractedData?.isMock && (
            <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }} className="text-warning" title="Running in mock mode.">
              <Sparkles size={12} /> Sandbox Mode
            </span>
          )}
        </div>

        {/* Row Selection Tabs */}
        <div style={{ display: 'flex', gap: '8px', padding: '16px 24px 8px 24px', borderBottom: '1px solid var(--border-glass)', overflowX: 'auto' }}>
          {rows.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`btn ${activeRowIdx === idx ? 'btn-primary' : 'btn-secondary'}`}
              style={{ 
                padding: '6px 12px', 
                fontSize: '0.8rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0
              }}
              onClick={() => setActiveRowIdx(idx)}
            >
              <Layers size={12} />
              <span>Row {idx + 1}</span>
              {rowHasError(idx) && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-error)' }} />
              )}
            </button>
          ))}
        </div>

        <div className="form-content">
          {/* Validation Warnings Summary Banner */}
          {localErrors.length > 0 && (
            <div className={`validation-summary-box ${localErrors.every(e => e.message.includes('Suspicious') || e.message.includes('Duplicate') || e.message.includes('repeated') || e.message.includes('0. Please')) ? 'warn-only' : ''}`}>
              <div className="validation-summary-title">
                <AlertTriangle size={16} className={localErrors.every(e => e.message.includes('Suspicious') || e.message.includes('Duplicate') || e.message.includes('repeated') || e.message.includes('0. Please')) ? 'text-warning' : 'text-error'} />
                <span>Validation Rule Alerts ({localErrors.length})</span>
              </div>
              <ul className="validation-summary-list">
                {localErrors.map((err, idx) => (
                  <li key={idx} style={{ cursor: 'pointer' }} onClick={() => setActiveRowIdx(err.rowIdx)}>
                    <span>•</span>
                    <span className={activeRowIdx === err.rowIdx ? 'text-main' : ''}>
                      {err.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Form Fields Grid */}
          <div className="form-grid">
            {/* Date field */}
            <div className="form-group">
              <label htmlFor="date">
                <span>Date</span>
                <span className={`confidence-dot ${getConfidenceInfo('date').colorClass}`} title={getConfidenceInfo('date').label} />
              </label>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  id="date" 
                  name="date"
                  placeholder="YYYY-MM-DD or DD/MM/YY"
                  className={`input-field ${localErrors.some(e => e.rowIdx === activeRowIdx && e.field === 'date') ? 'error-border' : ''}`}
                  value={getFieldValue(currentFields.date)}
                  onChange={handleInputChange}
                />
              </div>
              {getConfidenceInfo('date').reason && (
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px', fontStyle: 'italic' }}>
                  ⚠️ Reason: {getConfidenceInfo('date').reason}
                </span>
              )}
              {localErrors.filter(e => e.rowIdx === activeRowIdx && e.field === 'date').map((e, idx) => (
                <span key={idx} className="field-validation-msg error">{e.message}</span>
              ))}
            </div>

            {/* Shift field */}
            <div className="form-group">
              <label htmlFor="shift">
                <span>Shift</span>
                <span className={`confidence-dot ${getConfidenceInfo('shift').colorClass}`} title={getConfidenceInfo('shift').label} />
              </label>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  id="shift" 
                  name="shift"
                  placeholder="I, II, III or Shift A, B, C"
                  className={`input-field ${localErrors.some(e => e.rowIdx === activeRowIdx && e.field === 'shift') ? 'error-border' : ''}`}
                  value={getFieldValue(currentFields.shift)}
                  onChange={handleInputChange}
                />
              </div>
              {getConfidenceInfo('shift').reason && (
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px', fontStyle: 'italic' }}>
                  ⚠️ Reason: {getConfidenceInfo('shift').reason}
                </span>
              )}
              {localErrors.filter(e => e.rowIdx === activeRowIdx && e.field === 'shift').map((e, idx) => (
                <span key={idx} className="field-validation-msg error">{e.message}</span>
              ))}
            </div>

            {/* Employee Number */}
            <div className="form-group">
              <label htmlFor="employeeNumber">
                <span>Employee/Operator Number</span>
                <span className={`confidence-dot ${getConfidenceInfo('employeeNumber').colorClass}`} title={getConfidenceInfo('employeeNumber').label} />
              </label>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  id="employeeNumber" 
                  name="employeeNumber"
                  placeholder="e.g. BT1234"
                  className={`input-field ${localErrors.some(e => e.rowIdx === activeRowIdx && e.field === 'employeeNumber') ? 'error-border' : ''}`}
                  value={getFieldValue(currentFields.employeeNumber)}
                  onChange={handleInputChange}
                />
              </div>
              {getConfidenceInfo('employeeNumber').reason && (
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px', fontStyle: 'italic' }}>
                  ⚠️ Reason: {getConfidenceInfo('employeeNumber').reason}
                </span>
              )}
              {localErrors.filter(e => e.rowIdx === activeRowIdx && e.field === 'employeeNumber').map((e, idx) => (
                <span key={idx} className="field-validation-msg error">{e.message}</span>
              ))}
            </div>

            {/* Work Order Number */}
            <div className="form-group">
              <label htmlFor="workOrderNumber">
                <span>Work Order Number</span>
                <span className={`confidence-dot ${getConfidenceInfo('workOrderNumber').colorClass}`} title={getConfidenceInfo('workOrderNumber').label} />
              </label>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  id="workOrderNumber" 
                  name="workOrderNumber"
                  placeholder="e.g. 24686870"
                  className={`input-field ${
                    localErrors.some(e => e.rowIdx === activeRowIdx && e.field === 'workOrderNumber' && (e.message.includes('Duplicate') || e.message.includes('repeated'))) 
                      ? 'warn-border' 
                      : localErrors.some(e => e.rowIdx === activeRowIdx && e.field === 'workOrderNumber') 
                      ? 'error-border' 
                      : ''
                  }`}
                  value={getFieldValue(currentFields.workOrderNumber)}
                  onChange={handleInputChange}
                />
              </div>
              {getConfidenceInfo('workOrderNumber').reason && (
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px', fontStyle: 'italic' }}>
                  ⚠️ Reason: {getConfidenceInfo('workOrderNumber').reason}
                </span>
              )}
              {localErrors.filter(e => e.rowIdx === activeRowIdx && e.field === 'workOrderNumber').map((e, idx) => (
                <span key={idx} className={`field-validation-msg ${e.message.includes('Duplicate') || e.message.includes('repeated') ? 'warn' : 'error'}`}>{e.message}</span>
              ))}
            </div>

            {/* Operation Code */}
            <div className="form-group">
              <label htmlFor="operationCode">
                <span>Operation Code</span>
                <span className={`confidence-dot ${getConfidenceInfo('operationCode').colorClass}`} title={getConfidenceInfo('operationCode').label} />
              </label>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  id="operationCode" 
                  name="operationCode"
                  placeholder="e.g. 54321"
                  className={`input-field ${localErrors.some(e => e.rowIdx === activeRowIdx && e.field === 'operationCode') ? 'error-border' : ''}`}
                  value={getFieldValue(currentFields.operationCode)}
                  onChange={handleInputChange}
                />
              </div>
              {getConfidenceInfo('operationCode').reason && (
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px', fontStyle: 'italic' }}>
                  ⚠️ Reason: {getConfidenceInfo('operationCode').reason}
                </span>
              )}
              {localErrors.filter(e => e.rowIdx === activeRowIdx && e.field === 'operationCode').map((e, idx) => (
                <span key={idx} className="field-validation-msg error">{e.message}</span>
              ))}
            </div>

            {/* Machine Number */}
            <div className="form-group">
              <label htmlFor="machineNumber">
                <span>Machine Number</span>
                <span className={`confidence-dot ${getConfidenceInfo('machineNumber').colorClass}`} title={getConfidenceInfo('machineNumber').label} />
              </label>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  id="machineNumber" 
                  name="machineNumber"
                  placeholder="e.g. ABC-T30, MC-840"
                  className={`input-field ${localErrors.some(e => e.rowIdx === activeRowIdx && e.field === 'machineNumber') ? 'error-border' : ''}`}
                  value={getFieldValue(currentFields.machineNumber)}
                  onChange={handleInputChange}
                />
              </div>
              {getConfidenceInfo('machineNumber').reason && (
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px', fontStyle: 'italic' }}>
                  ⚠️ Reason: {getConfidenceInfo('machineNumber').reason}
                </span>
              )}
              {localErrors.filter(e => e.rowIdx === activeRowIdx && e.field === 'machineNumber').map((e, idx) => (
                <span key={idx} className="field-validation-msg error">{e.message}</span>
              ))}
            </div>

            {/* Quantity Produced */}
            <div className="form-group">
              <label htmlFor="quantityProduced">
                <span>Quantity Produced</span>
                <span className={`confidence-dot ${getConfidenceInfo('quantityProduced').colorClass}`} title={getConfidenceInfo('quantityProduced').label} />
              </label>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  id="quantityProduced" 
                  name="quantityProduced"
                  placeholder="e.g. 10 (Leave blank if none)"
                  className={`input-field ${
                    localErrors.some(e => e.rowIdx === activeRowIdx && e.field === 'quantityProduced' && e.message.includes('Suspicious')) 
                      ? 'warn-border' 
                      : localErrors.some(e => e.rowIdx === activeRowIdx && e.field === 'quantityProduced') 
                      ? 'error-border' 
                      : ''
                  }`}
                  value={getFieldValue(currentFields.quantityProduced)}
                  onChange={handleInputChange}
                />
              </div>
              {getConfidenceInfo('quantityProduced').reason && (
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px', fontStyle: 'italic' }}>
                  ⚠️ Reason: {getConfidenceInfo('quantityProduced').reason}
                </span>
              )}
              {localErrors.filter(e => e.rowIdx === activeRowIdx && e.field === 'quantityProduced').map((e, idx) => (
                <span key={idx} className={`field-validation-msg ${e.message.includes('Suspicious') || e.message.includes('0. Please') ? 'warn' : 'error'}`}>{e.message}</span>
              ))}
            </div>

            {/* Time Taken */}
            <div className="form-group">
              <label htmlFor="timeTaken">
                <span>Time Taken (Hours)</span>
                <span className={`confidence-dot ${getConfidenceInfo('timeTaken').colorClass}`} title={getConfidenceInfo('timeTaken').label} />
              </label>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  id="timeTaken" 
                  name="timeTaken"
                  placeholder="e.g. 6.0"
                  className={`input-field ${
                    localErrors.some(e => e.rowIdx === activeRowIdx && e.field === 'timeTaken' && e.message.includes('Suspicious')) 
                      ? 'warn-border' 
                      : localErrors.some(e => e.rowIdx === activeRowIdx && e.field === 'timeTaken') 
                      ? 'error-border' 
                      : ''
                  }`}
                  value={getFieldValue(currentFields.timeTaken)}
                  onChange={handleInputChange}
                />
              </div>
              {getConfidenceInfo('timeTaken').reason && (
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px', fontStyle: 'italic' }}>
                  ⚠️ Reason: {getConfidenceInfo('timeTaken').reason}
                </span>
              )}
              {localErrors.filter(e => e.rowIdx === activeRowIdx && e.field === 'timeTaken').map((e, idx) => (
                <span key={idx} className={`field-validation-msg ${e.message.includes('Suspicious') ? 'warn' : 'error'}`}>{e.message}</span>
              ))}
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="pane-footer">
          {apiError && <span className="text-error" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>{apiError}</span>}
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => handleSave(false)}
            disabled={saveLoading}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={16} /> Save Draft
            </span>
          </button>
          
          <button 
            type="button" 
            className="btn btn-success"
            onClick={() => handleSave(true)}
            disabled={saveLoading}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} /> Approve & Lock
            </span>
          </button>
        </div>
      </div>
    )}
  </div>
);
}
