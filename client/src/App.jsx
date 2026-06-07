import React, { useState, useEffect } from 'react';
import { BarChart3, UploadCloud, Database, Sparkles, FolderSync } from 'lucide-react';

import Dashboard from './components/Dashboard';
import UploadZone from './components/UploadZone';
import ReviewPanel from './components/ReviewPanel';
import HistoryList from './components/HistoryList';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'upload' | 'history'
  const [selectedReviewId, setSelectedReviewId] = useState(null); // String ID when review panel is open
  
  const [uploads, setUploads] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);

  // Fetch all uploads & analytics on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uploadsRes, analyticsRes] = await Promise.all([
        fetch('/api/uploads'),
        fetch('/api/analytics')
      ]);

      if (uploadsRes.ok && analyticsRes.ok) {
        const uploadsData = await uploadsRes.json();
        const analyticsData = await analyticsRes.json();
        setUploads(uploadsData);
        setAnalytics(analyticsData);
      }
    } catch (err) {
      console.error('Error fetching data from API server:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (id) => {
    setSelectedReviewId(id);
  };

  const handleBackFromReview = () => {
    setSelectedReviewId(null);
    fetchData(); // Refresh history and analytics
  };

  const handleSaveReviewSuccess = () => {
    setSelectedReviewId(null);
    fetchData(); // Refresh history and analytics
  };

  // If a document review is active, display the side-by-side view instead of the full tab layout
  if (selectedReviewId) {
    return (
      <div className="main-content" style={{ marginLeft: 0, padding: '24px' }}>
        <ReviewPanel 
          uploadId={selectedReviewId}
          allUploads={uploads}
          onBack={handleBackFromReview}
          onSaveSuccess={handleSaveReviewSuccess}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">
            <FolderSync size={24} />
          </div>
          <h1 className="logo-title">BiztelAI Flow</h1>
        </div>

        <nav className="nav-menu">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <BarChart3 size={18} />
            <span>Dashboard</span>
          </button>

          <button 
            onClick={() => setActiveTab('upload')}
            className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
          >
            <UploadCloud size={18} />
            <span>Ingest Document</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          >
            <Database size={18} />
            <span>Audit History</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={12} className="text-cyan" /> CSE Intern Assignment
          </p>
          <p style={{ opacity: 0.5 }}>BiztelAI Technologies</p>
        </div>
      </aside>

      {/* MAIN CONTAINER PANES */}
      <main className="main-content">
        {/* TAB 1: DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="view-header">
              <h2 className="view-title">Operations Dashboard</h2>
              <p className="view-subtitle">Visual indicators, performance stats, and validation metrics.</p>
            </div>
            <Dashboard 
              data={analytics} 
              uploads={uploads} 
              loading={loading} 
              onOpenReview={handleOpenReview} 
            />
          </div>
        )}

        {/* TAB 2: INGESTION LOG VIEW */}
        {activeTab === 'upload' && (
          <div>
            <div className="view-header">
              <h2 className="view-title">Document Ingestion</h2>
              <p className="view-subtitle">Upload handwritten sheets and view extraction queues.</p>
            </div>
            <UploadZone 
              onOpenReview={handleOpenReview} 
              onRefreshHistory={fetchData} 
            />
          </div>
        )}

        {/* TAB 3: AUDIT HISTORY VIEW */}
        {activeTab === 'history' && (
          <div>
            <div className="view-header">
              <h2 className="view-title">Operational Records</h2>
              <p className="view-subtitle">View details, filter historical documents, and audit updates.</p>
            </div>
            <HistoryList 
              uploads={uploads} 
              onOpenReview={handleOpenReview} 
              onRefresh={fetchData} 
            />
          </div>
        )}
      </main>
    </div>
  );
}
