import React from 'react';
import { 
  FileText, 
  UploadCloud, 
  Cpu, 
  CheckCircle2, 
  Archive, 
  AlertTriangle, 
  Clock, 
  Activity, 
  TrendingUp, 
  Compass, 
  ArrowRight, 
  FileWarning, 
  Percent, 
  Layers, 
  Hammer 
} from 'lucide-react';

export default function Dashboard({ data, uploads = [], loading, onOpenReview }) {
  if (loading) {
    return (
      <div className="flex-center" style={{ height: '300px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // 1. Safe field value getter
  const getVal = (field) => (field && field.value !== undefined) ? field.value : field;

  // 2. Compute Pipeline stages count
  const uploadedCount = uploads.length;
  const processedCount = uploads.filter(u => u.status === 'Pending Review' || u.status === 'Reviewed').length;
  const needsReviewCount = uploads.filter(u => u.status === 'Pending Review').length;
  const approvedCount = uploads.filter(u => u.status === 'Reviewed').length;
  const archivedCount = 0; // Mock archived count placeholder

  // 3. Compute AI Confidence Analytics segments (High, Med, Low counts)
  let highConfCount = 0;
  let medConfCount = 0;
  let lowConfCount = 0;
  let totalConfidenceSum = 0;
  let confidenceFieldsTallied = 0;

  uploads.forEach(u => {
    if (u.status !== 'Failed' && u.extractedData && Array.isArray(u.extractedData.rows)) {
      u.extractedData.rows.forEach(row => {
        const fieldKeys = ['date', 'shift', 'employeeNumber', 'operationCode', 'machineNumber', 'workOrderNumber', 'quantityProduced', 'timeTaken'];
        fieldKeys.forEach(key => {
          const fieldObj = row[key];
          if (fieldObj && typeof fieldObj === 'object') {
            const conf = fieldObj.confidence;
            if (typeof conf === 'number') {
              totalConfidenceSum += conf;
              confidenceFieldsTallied++;
              if (conf >= 0.95) highConfCount++;
              else if (conf >= 0.80) medConfCount++;
              else lowConfCount++;
            }
          } else {
            // Check flat properties fallback
            const conf = row[`${key}_confidence`];
            if (typeof conf === 'number') {
              totalConfidenceSum += conf;
              confidenceFieldsTallied++;
              if (conf >= 0.95) highConfCount++;
              else if (conf >= 0.80) medConfCount++;
              else lowConfCount++;
            }
          }
        });
      });
    }
  });

  const avgConfidence = confidenceFieldsTallied > 0 
    ? Math.round((totalConfidenceSum / confidenceFieldsTallied) * 100) 
    : 92;

  // 4. Compute Validation Issues tally
  let duplicateWOs = 0;
  let missingQty = 0;
  let invalidShifts = 0;
  let invalidMachineCodes = 0;
  let lowConfFieldsCount = lowConfCount; // Already calculated above

  uploads.forEach(u => {
    if (u.validationErrors && Array.isArray(u.validationErrors)) {
      u.validationErrors.forEach(err => {
        const msg = String(err.message).toLowerCase();
        if (msg.includes('duplicate') || msg.includes('repeated')) {
          duplicateWOs++;
        } else if (msg.includes('mandatory field') && err.field === 'quantityProduced') {
          missingQty++;
        } else if (msg.includes('invalid shift') || err.field === 'shift') {
          invalidShifts++;
        } else if (msg.includes('invalid machine') || err.field === 'machineNumber') {
          invalidMachineCodes++;
        }
      });
    }
  });

  const totalValidationIssues = duplicateWOs + missingQty + invalidShifts + invalidMachineCodes + lowConfFieldsCount;

  // 5. Normalizing Shift analytics (I, II, III only)
  const shiftList = ['I', 'II', 'III'].map(name => {
    const stats = data.shiftSummary?.[name] || { count: 0, quantity: 0 };
    return {
      name,
      count: stats.count,
      quantity: stats.quantity
    };
  }).sort((a, b) => b.quantity - a.quantity);

  const maxShiftQty = Math.max(...shiftList.map(s => s.quantity), 1);

  // 6. Machine Outputs (quantity and machine hours)
  const machineList = Object.entries(data.machineSummary || {}).map(([name, stats]) => ({
    name,
    count: stats.count,
    quantity: stats.quantity,
    hours: parseFloat(stats.hours.toFixed(1))
  })).sort((a, b) => b.quantity - a.quantity);

  const maxMachineQty = Math.max(...machineList.map(m => m.quantity), 1);

  // 7. Recent Activity Feed Timeline compilation
  const timelineEvents = [];
  uploads.forEach(u => {
    const time = new Date(u.uploadedAt);
    
    // Ingest Event
    timelineEvents.push({
      type: 'ingested',
      title: 'Document Ingested',
      description: `Operational log sheet "${u.fileName}" was uploaded to the platform.`,
      timestamp: time,
      badgeText: 'Upload',
      badgeClass: 'badge-indigo'
    });

    if (u.status !== 'Processing') {
      if (u.status === 'Failed') {
        timelineEvents.push({
          type: 'failed',
          title: 'Extraction Failed',
          description: `AI pipeline aborted extraction on file "${u.fileName}" due to illegibility limits.`,
          timestamp: new Date(time.getTime() + 1500),
          badgeText: 'Pipeline Aborted',
          badgeClass: 'badge-error'
        });
      } else {
        // AI Extracted Event
        timelineEvents.push({
          type: 'extracted',
          title: 'AI Extraction Complete',
          description: `Gemini extracted ${u.extractedData?.rows?.length || 0} rows from sheet "${u.fileName}".`,
          timestamp: new Date(time.getTime() + 2000),
          badgeText: 'AI Extracted',
          badgeClass: 'badge-cyan'
        });

        // Validation event if errors existed
        if (u.validationErrors && u.validationErrors.length > 0) {
          timelineEvents.push({
            type: 'alert',
            title: 'Validation Warnings Flagged',
            description: `Quality rules flagged ${u.validationErrors.length} alert(s) on file "${u.fileName}".`,
            timestamp: new Date(time.getTime() + 2500),
            badgeText: 'Alerts Flagged',
            badgeClass: 'badge-warning'
          });
        }

        // Reviewed Event
        if (u.status === 'Reviewed') {
          timelineEvents.push({
            type: 'reviewed',
            title: 'Record Approved',
            description: `Log sheet "${u.fileName}" was verified and approved by the floor supervisor.`,
            timestamp: new Date(time.getTime() + 5000),
            badgeText: 'Approved & Locked',
            badgeClass: 'badge-success'
          });
        }
      }
    }
  });

  // Sort timeline newest first and limit to top 5
  const activeTimeline = timelineEvents
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  // 8. Latest Uploaded Document Card
  const latestDoc = uploads.length > 0 ? uploads[0] : null;

  // 9. Pending Review Queue list (Limit 4)
  const pendingQueue = uploads
    .filter(u => u.status === 'Pending Review')
    .slice(0, 4);

  // Helper to count average confidence for a specific upload record
  const getRecordAverageConfidence = (record) => {
    if (!record || !record.extractedData || !Array.isArray(record.extractedData.rows)) return 0;
    let sumVal = 0;
    let counted = 0;
    record.extractedData.rows.forEach(row => {
      ['date', 'shift', 'employeeNumber', 'operationCode', 'machineNumber', 'workOrderNumber', 'quantityProduced', 'timeTaken'].forEach(k => {
        const fieldObj = row[k];
        const conf = (fieldObj && typeof fieldObj === 'object') ? fieldObj.confidence : row[`${k}_confidence`];
        if (typeof conf === 'number') {
          sumVal += conf;
          counted++;
        }
      });
    });
    return counted > 0 ? Math.round((sumVal / counted) * 100) : 90;
  };

  // Donut chart parameters
  const donutTotal = highConfCount + medConfCount + lowConfCount || 1;
  const pHigh = (highConfCount / donutTotal) * 100;
  const pMed = (medConfCount / donutTotal) * 100;
  const pLow = (lowConfCount / donutTotal) * 100;
  const donutRadius = 50;
  const donutCircumference = 2 * Math.PI * donutRadius; // 314.15
  const dHigh = donutCircumference * (pHigh / 100);
  const dMed = donutCircumference * (pMed / 100);
  const dLow = donutCircumference * (pLow / 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* 1. AI WORKFLOW PIPELINE PROGRESS TRACKER */}
      <div className="glass-panel" style={{ padding: '24px 32px' }}>
        <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '20px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} className="text-cyan" /> AI Operations Pipeline Status
        </h3>
        
        <div className="pipeline-tracker">
          <div className="pipeline-bg-line" />
          
          <div className="pipeline-step active">
            <div className="pipeline-icon-circle bg-indigo">
              <UploadCloud size={18} />
            </div>
            <div className="pipeline-details">
              <span className="pipeline-title">1. Ingested</span>
              <span className="pipeline-value">{uploadedCount} sheets</span>
            </div>
          </div>

          <div className={`pipeline-step ${processedCount > 0 ? 'active' : ''}`}>
            <div className="pipeline-icon-circle bg-cyan">
              <Cpu size={18} />
            </div>
            <div className="pipeline-details">
              <span className="pipeline-title">2. AI Extracted</span>
              <span className="pipeline-value">{processedCount} sheets</span>
            </div>
          </div>

          <div className={`pipeline-step ${needsReviewCount > 0 ? 'active' : ''}`}>
            <div className="pipeline-icon-circle bg-warning">
              <FileText size={18} />
            </div>
            <div className="pipeline-details">
              <span className="pipeline-title">3. Needs Review</span>
              <span className="pipeline-value">{needsReviewCount} alerts</span>
            </div>
          </div>

          <div className={`pipeline-step ${approvedCount > 0 ? 'active' : ''}`}>
            <div className="pipeline-icon-circle bg-success">
              <CheckCircle2 size={18} />
            </div>
            <div className="pipeline-details">
              <span className="pipeline-title">4. Approved & Locked</span>
              <span className="pipeline-value">{approvedCount} batches</span>
            </div>
          </div>

          <div className="pipeline-step">
            <div className="pipeline-icon-circle">
              <Archive size={18} />
            </div>
            <div className="pipeline-details">
              <span className="pipeline-title">5. Archived</span>
              <span className="pipeline-value">{archivedCount} records</span>
            </div>
          </div>
        </div>
      </div>

      {/* TWO COLUMN GENERAL GRID */}
      <div className="dashboard-grid">
        
        {/* LEFT PANEL GRID */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* 2. AI CONFIDENCE ANALYTICS (CUSTOM DONUT SVG) */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.05em' }}>
              OCR Confidence Analytics
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', marginTop: '10px' }}>
              <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                <svg width="130" height="130" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r={donutRadius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
                  
                  {/* High */}
                  <circle 
                    cx="60" cy="60" r={donutRadius} fill="none" 
                    stroke="var(--color-success)" strokeWidth="10" 
                    strokeDasharray={`${dHigh} ${donutCircumference}`}
                    strokeDashoffset={0}
                  />
                  {/* Medium */}
                  <circle 
                    cx="60" cy="60" r={donutRadius} fill="none" 
                    stroke="var(--color-warning)" strokeWidth="10" 
                    strokeDasharray={`${dMed} ${donutCircumference}`}
                    strokeDashoffset={-dHigh}
                  />
                  {/* Low */}
                  <circle 
                    cx="60" cy="60" r={donutRadius} fill="none" 
                    stroke="var(--color-error)" strokeWidth="10" 
                    strokeDasharray={`${dLow} ${donutCircumference}`}
                    strokeDashoffset={-(dHigh + dMed)}
                  />
                </svg>
                <div style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.45rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'white' }}>{avgConfidence}%</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg AI Score</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1, maxWidth: '200px' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} /> High (&gt;95%)
                  </span>
                  <span style={{ fontWeight: 600 }}>{highConfCount} fields</span>
                </div>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-warning)' }} /> Med (80-95%)
                  </span>
                  <span style={{ fontWeight: 600 }}>{medConfCount} fields</span>
                </div>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-error)' }} /> Low (&lt;80%)
                  </span>
                  <span style={{ fontWeight: 600 }} className="text-error">{lowConfCount} fields</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. VALIDATION ISSUES WIDGET */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
              <span>Validation Alerts Log</span>
              <span style={{ color: 'var(--color-error)', fontWeight: 600, fontSize: '0.8rem' }}>{totalValidationIssues} Total</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="validation-widget-row">
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                    <FileWarning size={14} className="opacity-60" /> Duplicate Work Orders
                  </span>
                  <span style={{ fontWeight: 600 }}>{duplicateWOs}</span>
                </div>
                <div className="validation-widget-track">
                  <div className="validation-widget-fill bg-indigo" style={{ width: `${Math.min((duplicateWOs / (totalValidationIssues || 1)) * 100, 100)}%` }} />
                </div>
              </div>

              <div className="validation-widget-row">
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                    <Layers size={14} className="opacity-60" /> Missing Quantity
                  </span>
                  <span style={{ fontWeight: 600 }}>{missingQty}</span>
                </div>
                <div className="validation-widget-track">
                  <div className="validation-widget-fill bg-cyan" style={{ width: `${Math.min((missingQty / (totalValidationIssues || 1)) * 100, 100)}%` }} />
                </div>
              </div>

              <div className="validation-widget-row">
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                    <Compass size={14} className="opacity-60" /> Invalid Shift Entries
                  </span>
                  <span style={{ fontWeight: 600 }}>{invalidShifts}</span>
                </div>
                <div className="validation-widget-track">
                  <div className="validation-widget-fill bg-warning" style={{ width: `${Math.min((invalidShifts / (totalValidationIssues || 1)) * 100, 100)}%` }} />
                </div>
              </div>

              <div className="validation-widget-row">
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                    <Hammer size={14} className="opacity-60" /> Invalid Machine Code
                  </span>
                  <span style={{ fontWeight: 600 }}>{invalidMachineCodes}</span>
                </div>
                <div className="validation-widget-track">
                  <div className="validation-widget-fill bg-warning" style={{ width: `${Math.min((invalidMachineCodes / (totalValidationIssues || 1)) * 100, 100)}%` }} />
                </div>
              </div>

              <div className="validation-widget-row">
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                    <Percent size={14} className="opacity-60 text-error" /> Low Confidence Cells
                  </span>
                  <span className="text-error" style={{ fontWeight: 600 }}>{lowConfFieldsCount}</span>
                </div>
                <div className="validation-widget-track">
                  <div className="validation-widget-fill bg-error" style={{ width: `${Math.min((lowConfFieldsCount / (totalValidationIssues || 1)) * 100, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* 5. RECENT ACTIVITY FEED TIMELINE */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '20px', letterSpacing: '0.05em' }}>
              Recent Activity Feed
            </h3>
            
            {activeTimeline.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px' }}>
                <p style={{ fontSize: '0.8rem' }}>No activity records found yet.</p>
              </div>
            ) : (
              <div className="activity-timeline">
                {activeTimeline.map((item, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className={`timeline-dot-gler dot-${item.type}`} />
                    <div className="timeline-content">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span className="timeline-title">{item.title}</span>
                        <span className={`badge ${item.badgeClass}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{item.badgeText}</span>
                      </div>
                      <p className="timeline-desc">{item.description}</p>
                      <span className="timeline-time">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT PANEL GRID */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* 6. AI INSIGHTS CARD */}
          <div className="glass-panel bg-insight-grad" style={{ padding: '24px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} className="text-indigo" /> Intelligent Operational Insights
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span className="badge success" style={{ fontSize: '0.7rem', padding: '3px 8px', marginTop: '2px' }}>Peak</span>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>
                    Highest Producing Shift: Shift {shiftList[0]?.name || 'N/A'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Shift {shiftList[0]?.name || 'N/A'} is leading production with a total output of {shiftList[0]?.quantity?.toLocaleString() || 0} units.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span className="badge warning" style={{ fontSize: '0.7rem', padding: '3px 8px', marginTop: '2px' }}>Alert</span>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>
                    Underutilized Asset: Machine {machineList[machineList.length - 1]?.name || 'N/A'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Machine {machineList[machineList.length - 1]?.name || 'N/A'} has recorded low production output ({machineList[machineList.length - 1]?.quantity || 0} units) in {machineList[machineList.length - 1]?.hours || 0} hours.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span className="badge error" style={{ fontSize: '0.7rem', padding: '3px 8px', marginTop: '2px' }}>Issue</span>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>
                    Duplicate Work Orders Flagged
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Found {duplicateWOs} duplicate work orders in this upload queue, indicating potential multi-sheet entries or repeat job records.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span className="badge processing" style={{ fontSize: '0.7rem', padding: '3px 8px', marginTop: '2px' }}>Audit</span>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>
                    Documents Requiring Validation
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    There are {needsReviewCount} files pending human supervisor review with active validation alerts (low confidence or format mismatch).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 7A. IMPROVED SHIFT PRODUCTION SUMMARY BAR CHART */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.05em' }}>
              Normalized Shift Output
            </h3>
            {shiftList.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px' }}>
                <p>No shift data recorded.</p>
              </div>
            ) : (
              <div className="bar-chart-container">
                {shiftList.map((shift, idx) => {
                  const percentage = (shift.quantity / maxShiftQty) * 100;
                  const fillGradient = idx === 0 
                    ? 'linear-gradient(to right, #6366f1, #a5b4fc)'
                    : idx === 1 
                    ? 'linear-gradient(to right, #06b6d4, #67e8f9)'
                    : 'linear-gradient(to right, #10b981, #34d399)';

                  return (
                    <div key={shift.name} className="bar-row">
                      <div className="bar-label" title={`Shift ${shift.name}`} style={{ fontWeight: 600 }}>
                        Shift {shift.name}
                      </div>
                      <div className="bar-track" style={{ height: '14px' }}>
                        <div 
                          className="bar-fill" 
                          style={{ width: `${percentage}%`, background: fillGradient }}
                        ></div>
                      </div>
                      <div className="bar-value">
                        {shift.quantity.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 7B. IMPROVED MACHINE PERFORMANCE OUTPUT (QTY + MACHINE HOURS) */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.05em' }}>
              Machine Performance (Output & Hours)
            </h3>
            {machineList.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px' }}>
                <p>No machine data recorded.</p>
              </div>
            ) : (
              <div className="bar-chart-container">
                {machineList.slice(0, 5).map((machine, idx) => {
                  const percentage = (machine.quantity / maxMachineQty) * 100;
                  return (
                    <div key={machine.name} className="bar-row" style={{ alignItems: 'flex-start' }}>
                      <div className="bar-label" title={machine.name} style={{ paddingTop: '2px' }}>
                        {machine.name}
                      </div>
                      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div className="bar-track" style={{ height: '10px' }}>
                          <div 
                            className="bar-fill" 
                            style={{ 
                              width: `${percentage}%`, 
                              background: 'linear-gradient(to right, #3b82f6, #06b6d4)' 
                            }}
                          ></div>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {machine.quantity.toLocaleString()} units produced
                        </span>
                      </div>
                      <div className="bar-value" style={{ fontSize: '0.8rem', paddingTop: '2px' }}>
                        {machine.hours} <span style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: 400 }}>hrs</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 8. LATEST UPLOADED DOCUMENT THUMBNAIL CARD */}
          {latestDoc && (
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div className="document-thumbnail-box flex-center">
                <FileText size={32} className="text-cyan" />
              </div>
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Latest Ingestion Batch
                </h4>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }} title={latestDoc.fileName}>
                  {latestDoc.fileName}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  {latestDoc.status === 'Processing' ? (
                    <span className="badge processing" style={{ fontSize: '0.65rem' }}>AI Reading...</span>
                  ) : latestDoc.status === 'Failed' ? (
                    <span className="badge error" style={{ fontSize: '0.65rem' }}>Aborted</span>
                  ) : latestDoc.status === 'Reviewed' ? (
                    <span className="badge success" style={{ fontSize: '0.65rem' }}>Locked</span>
                  ) : (
                    <span className="badge warning" style={{ fontSize: '0.65rem' }}>Needs Review</span>
                  )}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date(latestDoc.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              
              {(latestDoc.status === 'Pending Review' || latestDoc.status === 'Failed') && (
                <button 
                  onClick={() => onOpenReview(latestDoc.id)}
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {latestDoc.status === 'Failed' ? 'Inspect' : 'Review'} <ArrowRight size={12} />
                </button>
              )}
            </div>
          )}

        </div>

      </div>

      {/* 4. PENDING REVIEW QUEUE TABLE */}
      <div className="glass-panel" style={{ padding: '24px 32px' }}>
        <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.05em' }}>
          Needs Review Queue
        </h3>
        
        {pendingQueue.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <p>No records currently waiting in validation review queue.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Ingestion Date</th>
                  <th>Document Name</th>
                  <th>Validation Alerts</th>
                  <th>Avg AI Confidence</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingQueue.map(item => {
                  const avgConf = getRecordAverageConfidence(item);
                  const errorCount = item.validationErrors?.length || 0;
                  
                  return (
                    <tr key={item.id}>
                      <td>
                        {new Date(item.uploadedAt).toLocaleDateString()}
                        <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6 }}>
                          {new Date(item.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'white' }}>{item.fileName}</td>
                      <td>
                        {errorCount > 0 ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }} className={item.validationErrors.every(e => e.message.includes('Suspicious') || e.message.includes('Duplicate') || e.message.includes('repeated')) ? 'text-warning' : 'text-error'}>
                            <AlertTriangle size={14} /> {errorCount} alerts flagged
                          </span>
                        ) : (
                          <span className="text-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} /> Ready for locking
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`confidence-dot ${avgConf >= 90 ? 'high' : avgConf >= 75 ? 'med' : 'low'}`} style={{ position: 'static' }} />
                          <span>{avgConf}%</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge warning">Pending</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          onClick={() => onOpenReview(item.id)}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          Review &amp; Lock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
