import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Play } from 'lucide-react';

export default function UploadZone({ onOpenReview, onRefreshHistory }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState([]);
  const fileInputRef = useRef(null);

  // Poll for status updates if there are any active "Processing" uploads
  useEffect(() => {
    const activeProcessing = uploads.some(u => u.status === 'Processing');
    if (!activeProcessing) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/uploads');
        if (response.ok) {
          const remoteUploads = await response.json();
          
          // Map local uploads state with the remote state
          setUploads(prevUploads => {
            return prevUploads.map(local => {
              const remote = remoteUploads.find(r => r.id === local.id);
              if (remote) {
                // If it transitioned from processing, refresh history dashboard metrics
                if (local.status === 'Processing' && remote.status !== 'Processing') {
                  if (onRefreshHistory) onRefreshHistory();
                }
                return { ...local, ...remote };
              }
              return local;
            });
          });
        }
      } catch (err) {
        console.error('Error polling uploads status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [uploads, onRefreshHistory]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleFiles = async (fileList) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!allowedTypes.includes(file.type)) {
        alert(`File type not supported: ${file.name}. Please upload JPEG, PNG, or PDF.`);
        continue;
      }

      // Add placeholder status card
      const tempId = 'temp_' + Math.random().toString(36).substr(2, 9);
      const newUploadObj = {
        id: tempId,
        fileName: file.name,
        status: 'Processing',
        progress: 0,
        uploadedAt: new Date().toISOString()
      };
      
      setUploads(prev => [newUploadObj, ...prev]);

      // Prepare multi-part form data
      const formData = new FormData();
      formData.append('document', file);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Server rejected file upload');
        }

        const data = await response.json();
        
        // Swap temp state with actual backend response
        setUploads(prev => prev.map(u => 
          u.id === tempId ? { ...u, ...data.record } : u
        ));

        if (onRefreshHistory) onRefreshHistory();
      } catch (error) {
        console.error('Failed to upload file:', error);
        setUploads(prev => prev.map(u => 
          u.id === tempId ? { ...u, status: 'Failed', error: error.message } : u
        ));
      }
    }
  };

  return (
    <div className="upload-view-layout">
      {/* Upload Zone Left Panel */}
      <div className="glass-panel" style={{ padding: '32px' }}>
        <h3 style={{ marginBottom: '16px', color: 'white' }}>Upload Document</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
          Upload a handwritten or semi-structured operational log sheet (PDF or image format).
          Our system will digitize the sheet, perform OCR, and run business validation checks.
        </p>

        <div 
          className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
        >
          <UploadCloud size={48} className="upload-icon" />
          <div>
            <p style={{ fontWeight: 600, color: 'white', marginBottom: '4px' }}>
              Drag & Drop files here
            </p>
            <p style={{ fontSize: '0.8rem' }}>or click to browse from folder</p>
          </div>
          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Supports: PNG, JPG, JPEG, PDF (max 10MB)</span>
          <button type="button" className="btn-upload-select" onClick={(e) => {
            e.stopPropagation();
            triggerFileSelect();
          }}>
            Select File
          </button>
          <input 
            type="file"
            ref={fileInputRef}
            className="file-input-hidden"
            accept=".png, .jpg, .jpeg, .pdf"
            multiple
            onChange={handleFileInputChange}
          />
        </div>
      </div>

      {/* Upload Processing Right Panel */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '380px' }}>
        <h3 style={{ marginBottom: '16px', color: 'white' }}>Current Session Batches</h3>
        
        {uploads.length === 0 ? (
          <div className="empty-state" style={{ flexGrow: 1 }}>
            <FileText size={36} style={{ opacity: 0.4 }} />
            <p style={{ fontSize: '0.9rem' }}>No files uploaded in this session.</p>
          </div>
        ) : (
          <div className="upload-status-list" style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '350px', paddingRight: '4px' }}>
            {uploads.map(u => (
              <div key={u.id} className="status-card glass-panel">
                <div className="status-details">
                  {u.status === 'Processing' ? (
                    <div className="spinner"></div>
                  ) : u.status === 'Failed' ? (
                    <AlertCircle className="text-error" size={20} />
                  ) : (
                    <CheckCircle2 className="text-success" size={20} />
                  )}
                  
                  <div>
                    <h5 style={{ fontWeight: 500, fontSize: '0.85rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={u.fileName}>
                      {u.fileName}
                    </h5>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {new Date(u.uploadedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {u.status === 'Processing' ? (
                    <span className="badge processing">AI Reading...</span>
                  ) : u.status === 'Failed' ? (
                    <span className="badge error" title={u.error || 'Extraction Failed'}>Failed</span>
                  ) : u.status === 'Reviewed' ? (
                    <span className="badge success">Reviewed</span>
                  ) : (
                    <span className="badge warning">Needs Review</span>
                  )}

                  {(u.status === 'Pending Review' || u.status === 'Reviewed' || u.status === 'Failed') && (
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => onOpenReview(u.id)}
                    >
                      <Play size={12} fill="white" /> {u.status === 'Failed' ? 'Inspect' : 'Review'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
