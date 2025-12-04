import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteClaimedAndPaidRecords, setReminderNotification, clearReminderNotification, setAttentionNote, triggerForceLogout, clearForceLogout } from '../services/firestoreService';
import { fetchCustomers } from '../services/sheetsService';
import { CustomerRecord, ReminderItem } from '../types';
import { useAdminAuth } from '../context/AdminAuthContext';

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

const ATTENTION_NOTE_STORAGE_KEY = 'kwiksilver:attention_note';

export default function OverridePage() {
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [attentionNote, setAttentionNoteText] = useState(() => {
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem(ATTENTION_NOTE_STORAGE_KEY);
      return saved || '';
    } catch {
      return '';
    }
  });
  const [sendingAttentionNote, setSendingAttentionNote] = useState(false);
  const [attentionNoteMessage, setAttentionNoteMessage] = useState<string | null>(null);
  const [forcingLogout, setForcingLogout] = useState(false);
  const [forceLogoutMessage, setForceLogoutMessage] = useState<string | null>(null);

  // Save to localStorage whenever attentionNote changes
  useEffect(() => {
    try {
      if (attentionNote.trim()) {
        localStorage.setItem(ATTENTION_NOTE_STORAGE_KEY, attentionNote);
      } else {
        localStorage.removeItem(ATTENTION_NOTE_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to save attention note to localStorage:', error);
    }
  }, [attentionNote]);

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
        await setReminderNotification(payload);
        setReminderMessage(`✅ Sent reminder for ${reminderItems.length} customer${reminderItems.length === 1 ? '' : 's'}.`);
      } else {
        await clearReminderNotification();
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

  const handleSendAttentionNote = async () => {
    if (!attentionNote.trim()) {
      setAttentionNoteMessage('⚠️ Please enter an announcement message.');
      setTimeout(() => setAttentionNoteMessage(null), 3000);
      return;
    }

    setSendingAttentionNote(true);
    setAttentionNoteMessage(null);

    try {
      await setAttentionNote(attentionNote.trim(), 'Nikka');
      setAttentionNoteMessage('✅ Attention note sent successfully!');
      // Don't clear the text field - retain the value for easy re-sending
      setTimeout(() => setAttentionNoteMessage(null), 5000);
    } catch (error) {
      console.error('Error sending attention note:', error);
      setAttentionNoteMessage(`❌ Error sending attention note: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSendingAttentionNote(false);
      setTimeout(() => setAttentionNoteMessage(null), 5000);
    }
  };

  const handleClearAttentionNote = () => {
    setAttentionNoteText('');
    setAttentionNoteMessage(null);
    try {
      localStorage.removeItem(ATTENTION_NOTE_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear attention note from localStorage:', error);
    }
  };

  const handleForceLogout = async () => {
    const confirmMessage = 'Are you sure you want to force logout ALL users? This will immediately log out everyone who is currently logged in.';
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setForcingLogout(true);
    setForceLogoutMessage(null);

    try {
      const triggeredBy = user?.name || user?.username || 'Admin';
      await triggerForceLogout(triggeredBy);
      setForceLogoutMessage('✅ Force logout triggered successfully. All users will be logged out immediately.');
      setTimeout(() => setForceLogoutMessage(null), 5000);
    } catch (error) {
      console.error('Error triggering force logout:', error);
      setForceLogoutMessage(`❌ Error triggering force logout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setForcingLogout(false);
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

        <div className="control-card">
          <div className="control-card-header">
            <h4 className="control-card-title">Generate Daily Report</h4>
          </div>
          <div className="control-card-description">
            <p>
              Review today&apos;s summary of customers marked as Done and Claimed
              &amp; Paid. Helpful for end-of-day reporting and reconciliation.
            </p>
          </div>
          <div className="control-card-actions">
            <button
              className="btn-control-secondary"
              onClick={() => navigate('/override/report')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 4h18"></path>
                <path d="M8 4v16"></path>
                <path d="M16 4v16"></path>
                <path d="M3 12h18"></path>
                <path d="M3 20h18"></path>
              </svg>
              <span>Generate Report</span>
            </button>
          </div>
        </div>

        <div className="control-card">
          <div className="control-card-header">
            <h4 className="control-card-title">Update Backend Data</h4>
          </div>
          <div className="control-card-description">
            <p>
              Edit status, date dropped, date done, date paid, and their timestamps
              for any record. Useful for correcting data or backdating entries.
            </p>
            <ul className="control-list">
              <li>Update status, date dropped, date done, and date paid.</li>
              <li>Automatically handles date/time field cleanup based on status changes.</li>
              <li>Changes are saved directly to Firestore.</li>
            </ul>
          </div>
          <div className="control-card-actions">
            <button
              className="btn-control-orange"
              onClick={() => navigate('/override/update-backend-data')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Update Backend Data</span>
            </button>
          </div>
        </div>

        <div className="control-card">
          <div className="control-card-header">
            <h4 className="control-card-title">Send Attention Note</h4>
          </div>
          <div className="control-card-description">
            <p>
              Send an announcement popup to the Admin Control page. The popup will appear
              immediately on all devices without refreshing.
            </p>
            <p className="control-warning">⚠️ This will replace any existing attention note.</p>
          </div>
          <div className="control-card-actions">
            <div className="attention-note-input-wrapper">
              <textarea
                className="attention-note-input"
                placeholder="Enter your announcement message here..."
                value={attentionNote}
                onChange={(e) => setAttentionNoteText(e.target.value)}
                rows={4}
                disabled={sendingAttentionNote}
              />
              {attentionNote && (
                <button
                  type="button"
                  className="attention-note-clear-btn"
                  onClick={handleClearAttentionNote}
                  disabled={sendingAttentionNote}
                  title="Clear text"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              className="btn-control-green"
              onClick={handleSendAttentionNote}
              disabled={sendingAttentionNote || !attentionNote.trim()}
            >
              {sendingAttentionNote ? (
                <>
                  <div className="spinner-small" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 2L11 13"></path>
                    <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
                  </svg>
                  <span>Send Attention Note</span>
                </>
              )}
            </button>
            {attentionNoteMessage && (
              <div className={`control-message ${attentionNoteMessage.includes('✅') ? 'success' : attentionNoteMessage.includes('❌') ? 'error' : 'info'}`}>
                {attentionNoteMessage}
              </div>
            )}
          </div>
        </div>

        <div className="control-card">
          <div className="control-card-header">
            <h4 className="control-card-title">Force Logout All Users</h4>
          </div>
          <div className="control-card-description">
            <p>
              Immediately log out all users who are currently logged in. This is useful when:
            </p>
            <ul className="control-list">
              <li>An employee has been terminated and you need to revoke access immediately.</li>
              <li>There is a security concern and you need to force re-authentication.</li>
              <li>You want to ensure all users log in with fresh credentials.</li>
            </ul>
            <p className="control-warning">⚠️ This will log out ALL users immediately, including yourself. You will need to log in again.</p>
          </div>
          <div className="control-card-actions">
            <button
              className="btn-control-warning"
              onClick={handleForceLogout}
              disabled={forcingLogout}
            >
              {forcingLogout ? (
                <>
                  <div className="spinner-small" />
                  <span>Triggering logout...</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  <span>Force Logout All Users</span>
                </>
              )}
            </button>
            {forceLogoutMessage && (
              <div className={`control-message ${forceLogoutMessage.includes('✅') ? 'success' : forceLogoutMessage.includes('❌') ? 'error' : 'info'}`}>
                {forceLogoutMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
