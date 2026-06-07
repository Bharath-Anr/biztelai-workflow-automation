import React, { useState } from 'react';
import { Search, Eye, Filter, RefreshCw, Layers } from 'lucide-react';

export default function HistoryList({ uploads, onOpenReview, onRefresh }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');

  // Filter logic
  const filteredUploads = uploads.filter(u => {
    const getVal = (field) => (field && field.value !== undefined) ? field.value : field;
    const rows = u.extractedData?.rows || [];
    
    // Search match
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      u.fileName.toLowerCase().includes(searchLower) ||
      rows.some(r => {
        const wo = getVal(r.workOrderNumber) || '';
        const emp = getVal(r.employeeNumber) || '';
        const mach = getVal(r.machineNumber) || '';
        const op = getVal(r.operationCode) || '';
        return wo.toLowerCase().includes(searchLower) ||
               emp.toLowerCase().includes(searchLower) ||
               mach.toLowerCase().includes(searchLower) ||
               op.toLowerCase().includes(searchLower);
      });

    // Status filter match
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;

    // Shift filter match
    const matchesShift = shiftFilter === 'ALL' || 
      rows.some(r => {
        const sh = getVal(r.shift) || '';
        return sh.trim().toUpperCase() === shiftFilter.toUpperCase();
      });

    return matchesSearch && matchesStatus && matchesShift;
  });

  return (
    <div className="glass-panel" style={{ padding: '32px' }}>
      {/* Table Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ color: 'white' }}>Audit Log & History</h3>
        <button 
          onClick={onRefresh} 
          className="btn btn-secondary" 
          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} /> Refresh Logs
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filters-bar">
        {/* Search */}
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <Search 
            size={18} 
            style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-muted)' }} 
          />
          <input 
            type="text"
            className="input-field search-input"
            style={{ paddingLeft: '44px' }}
            placeholder="Search by file name, WO, machine, operator code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} className="opacity-60" />
          <select 
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="Processing">Processing</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        {/* Shift Filter */}
        <div>
          <select 
            className="filter-select"
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
          >
            <option value="ALL">All Shifts</option>
            <option value="Shift A">Shift A / I</option>
            <option value="Shift B">Shift B / II</option>
            <option value="Shift C">Shift C / III</option>
          </select>
        </div>
      </div>

      {/* Table Records View */}
      {filteredUploads.length === 0 ? (
        <div className="empty-state">
          <p>No records match the active search filters.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>Upload Date</th>
                <th>File Name</th>
                <th>Work Orders</th>
                <th>Shifts</th>
                <th>Total Quantity</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUploads.map(u => {
                const rows = u.extractedData?.rows || [];
                
                const getVal = (field) => (field && field.value !== undefined) ? field.value : field;

                // Get unique work orders
                const uniqueWOs = [...new Set(rows.map(r => getVal(r.workOrderNumber)).filter(Boolean))];
                const woSummary = uniqueWOs.join(', ') || '-';
                
                // Get unique shifts
                const uniqueShifts = [...new Set(rows.map(r => getVal(r.shift)).filter(Boolean))];
                const shiftSummary = uniqueShifts.join(', ') || '-';

                // Sum quantities and time
                const totalQty = rows.reduce((sum, r) => sum + (parseFloat(getVal(r.quantityProduced)) || 0), 0);
                const totalTime = rows.reduce((sum, r) => sum + (parseFloat(getVal(r.timeTaken)) || 0), 0);
                
                return (
                  <tr key={u.id}>
                    <td>
                      {new Date(u.uploadedAt).toLocaleDateString()}
                      <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6 }}>
                        {new Date(u.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      <span title={u.fileName} style={{ display: 'block', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.fileName}
                      </span>
                      {rows.length > 0 && (
                        <span style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }} className="text-cyan">
                          <Layers size={10} /> {rows.length} rows extracted
                        </span>
                      )}
                    </td>
                    <td>
                      <span title={woSummary} style={{ display: 'block', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {woSummary}
                      </span>
                    </td>
                    <td>{shiftSummary}</td>
                    <td>
                      {totalQty ? totalQty.toLocaleString() : '-'}
                      {totalTime > 0 && (
                        <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6 }}>
                          in {totalTime} hrs
                        </span>
                      )}
                    </td>
                    <td>
                      {u.status === 'Processing' ? (
                        <span className="badge processing">Processing</span>
                      ) : u.status === 'Failed' ? (
                        <span className="badge error">Failed</span>
                      ) : u.status === 'Reviewed' ? (
                        <span className="badge success">Reviewed</span>
                      ) : (
                        <span className="badge warning" title={`${u.validationErrors?.length || 0} alerts`}>
                          Pending ({u.validationErrors?.length || 0} Alerts)
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {(u.status === 'Pending Review' || u.status === 'Reviewed') ? (
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => onOpenReview(u.id)}
                        >
                          <Eye size={14} /> Open
                        </button>
                      ) : (
                        <span className="opacity-40" style={{ fontSize: '0.8rem' }}>Unavailable</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
