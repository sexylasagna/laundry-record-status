import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteClaimedAndPaidRecords } from '../services/firestoreService';
import { fetchCustomers } from '../services/sheetsService';
import { CustomerRecord, ReminderItem } from '../types';

const REMINDER_STORAGE_KEY = 'admin-reminder-notification';

function getDaysSince(dateString: string | undefined): number {
  if (!dateString) return 0;
  const [datePart] = dateString.trim().split(' ');
  const parsed = new Date(datePart);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }
  const now = new Date();
  const diff = now.getTime() - parsed.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function OverridePage() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

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

  const handleSendReminderNotification = async () => {
    setSendingReminder(true);
    setReminderMessage(null);

    try {
      const records = await fetchCustomers();
      const reminderItems: ReminderItem[] = [];

      records.forEach((record: CustomerRecord) => {
        const daysSinceDropped = getDaysSince(record.dateDropped);
        if (record.status === 1 && daysSinceDropped >= 2) {
          reminderItems.push({ id: record.id, type: 'in-progress' });
          return;
        }

        if (record.status === 2) {
          if (record.dateDone) {
            const daysSinceDone = getDaysSince(record.dateDone);
            if (daysSinceDone > 3) {
              reminderItems.push({ id: record.id, type: 'done' });
            }
          } else if (daysSinceDropped > 3) {
            reminderItems.push({ id: record.id, type: 'done' });
          }
        }
      });

      if (reminderItems.length > 0) {
        const payload = {
          createdAt: new Date().toISOString(),
          items: reminderItems,
        };
        window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(payload));
        window.dispatchEvent(new Event('admin-reminder-updated'));
        setReminderMessage(`✅ Sent reminder for ${reminderItems.length} customer${reminderItems.length === 1 ? '' : 's'}.`);
      } else {
        window.localStorage.removeItem(REMINDER_STORAGE_KEY);
        window.dispatchEvent(new Event('admin-reminder-updated'));
        setReminderMessage('ℹ️ No overdue customers found for reminder.');
      }
    } catch (error) {
      console.error('Error sending reminder notification:', error);
      setReminderMessage(`❌ Error sending reminder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSendingReminder(false);
      setTimeout(() => setReminderMessage(null), 5000);
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

        <div className="control-card">
          <div className="control-card-header">
            <h4 className="control-card-title">Send Admin Reminder Popup</h4>
          </div>
          <div className="control-card-description">
            <p>
              Trigger a reminder popup on the admin dashboard for customers who need follow-up:
            </p>
            <ul className="control-list">
              <li>In progress for 2 or more days since date dropped.</li>
              <li>Done for more than 3 days but still not claimed &amp; paid.</li>
            </ul>
            <p>The popup appears immediately without refreshing.</p>
          </div>
          <div className="control-card-actions">
            <button
              className="btn-control-primary"
              onClick={handleSendReminderNotification}
              disabled={sendingReminder}
            >
              {sendingReminder ? (
                <>
                  <div className="spinner-small" />
                  <span>Sending reminder...</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 5v6a7 7 0 0 0 14 0V5"></path>
                    <path d="M21 3H3"></path>
                    <path d="M7 21h10"></path>
                  </svg>
                  <span>Send Admin Reminder Popup</span>
                </>
              )}
            </button>
            {reminderMessage && (
              <div className={`control-message ${reminderMessage.includes('✅') ? 'success' : reminderMessage.includes('❌') ? 'error' : 'info'}`}>
                {reminderMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
