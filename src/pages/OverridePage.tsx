import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteClaimedAndPaidRecords } from '../services/firestoreService';

export default function OverridePage() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const handleDeleteClaimedAndPaid = async () => {
    // Confirm before deleting
    const confirmMessage = 'Are you sure you want to delete all Claimed & Paid records from Firestore? This action cannot be undone.';
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeleting(true);
    setDeleteMessage(null);

    try {
      const deletedCount = await deleteClaimedAndPaidRecords();
      
      if (deletedCount === 0) {
        setDeleteMessage('ℹ️ No Claimed & Paid records found to delete.');
      } else {
        setDeleteMessage(`✅ Successfully deleted ${deletedCount} Claimed & Paid record(s) from Firestore.`);
      }
      
      // Clear message after 5 seconds
      setTimeout(() => setDeleteMessage(null), 5000);
    } catch (error) {
      console.error('Error deleting records:', error);
      setDeleteMessage(`❌ Error deleting records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="override-back-container">
        <button 
          className="btn-back" 
          onClick={() => navigate('/admin')}
          title="Back to Admin"
        >
          ← Back
        </button>
      </div>
      
      <div className="override-header">
        <h2>Override Control</h2>
        <p className="override-description">
          This is override control actions.
        </p>
        <p className="override-subdescription">
          This page will be updated over time based on new control.
        </p>
      </div>

      <div className="override-controls">
        <h3 className="override-section-title">Add Control</h3>
        
        <div className="control-card">
          <div className="control-card-header">
            <h4 className="control-card-title">Delete Claimed & Paid Data in Firestore</h4>
          </div>
          <div className="control-card-description">
            <p>Check records which are already Claimed and paid / status = 3 and delete it from Firestore.</p>
            <p className="control-warning">⚠️ This action is permanent and cannot be undone.</p>
          </div>
          <div className="control-card-actions">
            <button
              className="btn-control-danger"
              onClick={handleDeleteClaimedAndPaid}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <div className="spinner-small" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>Delete Claimed & Paid Records</span>
                </>
              )}
            </button>
            {deleteMessage && (
              <div className={`control-message ${deleteMessage.includes('✅') ? 'success' : deleteMessage.includes('❌') ? 'error' : 'info'}`}>
                {deleteMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
