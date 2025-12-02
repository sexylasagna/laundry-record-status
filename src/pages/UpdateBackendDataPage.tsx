import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCustomers } from '../services/sheetsService';
import { updateBackendDataInFirestore, deleteCustomerRecord } from '../services/firestoreService';
import { CustomerRecord, LaundryStatus } from '../types';
import AdminSearchBar from '../components/AdminSearchBar';

// Helper to format date for dateDropped input (YYYY-MM-DD HH:MM AM/PM)
function formatDateDroppedForInput(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  // If it's already in the format "2025-11-10 03:20 PM", return as is
  if (trimmed.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/)) {
    return trimmed;
  }

  // If it's an ISO string, parse it
  if (trimmed.includes('T')) {
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${dateStr} ${timeStr}`;
    }
  }

  // If it's just a date, add default time
  const parts = trimmed.split(' ');
  if (parts.length === 1) {
    return `${parts[0]} 12:00 PM`;
  }

  return trimmed;
}

// Helper to format date for date input (YYYY-MM-DD)
function formatDateForInput(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.includes('T')) {
    return trimmed.split('T')[0];
  }

  return trimmed.split(' ')[0];
}

// Helper to format datetime for datetime-local input
function formatDateTimeForInput(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.includes('T')) {
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      // Convert to local datetime string (YYYY-MM-DDTHH:mm)
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      const hours = `${date.getHours()}`.padStart(2, '0');
      const minutes = `${date.getMinutes()}`.padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
  }

  return '';
}

// Convert date input (YYYY-MM-DD) to format "YYYY-MM-DD"
function formatDateOutput(value: string): string {
  if (!value || !value.trim()) return '';
  return value.trim();
}

// Convert datetime input to ISO string
function formatDateTimeOutput(value: string): string {
  if (!value || !value.trim()) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

// Convert dateDropped input to format "YYYY-MM-DD HH:MM AM/PM"
function formatDateDroppedOutput(value: string): string {
  if (!value || !value.trim()) return '';
  const trimmed = value.trim();
  
  // If already in correct format, return as is
  if (trimmed.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)$/)) {
    return trimmed;
  }

  // Try to parse as datetime-local format
  if (trimmed.includes('T')) {
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${dateStr} ${timeStr}`;
    }
  }

  // Try to parse as date only
  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    const dateStr = date.toISOString().split('T')[0];
    return `${dateStr} 12:00 PM`;
  }

  return trimmed;
}

interface EditFormData {
  status: LaundryStatus;
  dateDropped: string;
  dateDone: string;
  dateDoneTime: string;
  datePaid: string;
  datePaidTime: string;
}

export default function UpdateBackendDataPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = useState<LaundryStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCustomers();
        if (active) {
          setRecords(data);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading records:', err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  // Filter records based on search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) {
      return records;
    }
    const query = searchQuery.trim().toLowerCase();
    return records.filter((record) =>
      record.customerName.toLowerCase().includes(query)
    );
  }, [records, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const startEdit = (record: CustomerRecord) => {
    setEditingId(record.id);
    setOriginalStatus(record.status);
    setEditForm({
      status: record.status,
      dateDropped: formatDateDroppedForInput(record.dateDropped),
      dateDone: formatDateForInput(record.dateDone),
      dateDoneTime: formatDateTimeForInput(record.dateDoneTime),
      datePaid: formatDateForInput(record.datePaid),
      datePaidTime: formatDateTimeForInput(record.datePaidTime),
    });
    setSaveMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setOriginalStatus(null);
    setSaveMessage(null);
  };

  const handleSave = async (id: string) => {
    if (!editForm) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      // Determine what to update based on status changes and field removals
      const newStatus = editForm.status;
      const oldStatus = originalStatus;

      // Format outputs
      const dateDropped = formatDateDroppedOutput(editForm.dateDropped);
      const dateDone = editForm.dateDone.trim() ? formatDateOutput(editForm.dateDone) : undefined;
      const dateDoneTime = editForm.dateDoneTime.trim() ? formatDateTimeOutput(editForm.dateDoneTime) : undefined;
      const datePaid = editForm.datePaid.trim() ? formatDateOutput(editForm.datePaid) : undefined;
      const datePaidTime = editForm.datePaidTime.trim() ? formatDateTimeOutput(editForm.datePaidTime) : undefined;

      await updateBackendDataInFirestore(
        id,
        {
          status: newStatus,
          dateDropped,
          dateDone: dateDone || null,
          dateDoneTime: dateDoneTime || null,
          datePaid: datePaid || null,
          datePaidTime: datePaidTime || null,
          oldStatus,
        }
      );

      // Refresh records
      const updated = await fetchCustomers();
      setRecords(updated);
      setSaveMessage('✅ Record updated successfully!');
      setTimeout(() => {
        setEditingId(null);
        setEditForm(null);
        setOriginalStatus(null);
        setSaveMessage(null);
      }, 1500);
    } catch (err) {
      console.error('Error updating record:', err);
      setSaveMessage(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
    setDeleteMessage(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletingId(null);
    setDeleteMessage(null);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setDeleting(true);
    setDeleteMessage(null);

    try {
      await deleteCustomerRecord(deletingId);
      
      // Refresh records
      const updated = await fetchCustomers();
      setRecords(updated);
      
      setDeleteMessage('✅ Record deleted successfully!');
      setShowDeleteConfirm(false);
      
      // Close edit form if it was open for this record
      if (editingId === deletingId) {
        setEditingId(null);
        setEditForm(null);
        setOriginalStatus(null);
      }
      
      setTimeout(() => {
        setDeletingId(null);
        setDeleteMessage(null);
      }, 1500);
    } catch (err) {
      console.error('Error deleting record:', err);
      setDeleteMessage(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="update-backend-page">
        <div className="update-backend-loading">
          <div className="spinner-large" />
          <span>Loading records...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="update-backend-page">
        <div className="update-backend-error">
          <p>Unable to load records.</p>
          <p className="update-backend-error-details">{error}</p>
          <button
            type="button"
            className="btn-control-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="update-backend-page">
      <div className="update-backend-header">
        <button
          type="button"
          className="btn-back"
          onClick={() => navigate('/override')}
        >
          ← Back to Override Controls
        </button>
        <h2>Update Backend Data</h2>
        <p className="update-backend-subtitle">
          Edit status, dates, and timestamps for any record. Changes are saved to Firestore.
        </p>
      </div>

      <div className="update-backend-search">
        <AdminSearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      <div className="update-backend-list">
        {filteredRecords.length === 0 ? (
          <p className="update-backend-empty">
            {searchQuery ? 'No records match your search.' : 'No records found.'}
          </p>
        ) : (
          <>
            {paginatedRecords.map((record) => (
            <div key={record.id} className="update-backend-card">
              {editingId === record.id ? (
                <div className="update-backend-edit-form">
                  <div className="update-backend-form-row">
                    <label>
                      <span>Customer Name:</span>
                      <strong>{record.customerName}</strong>
                    </label>
                  </div>

                  <div className="update-backend-form-row">
                    <label>
                      <span>Status:</span>
                      <select
                        value={editForm!.status}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm!,
                            status: Number(e.target.value) as LaundryStatus,
                          })
                        }
                      >
                        <option value={1}>In Progress</option>
                        <option value={2}>Done</option>
                        <option value={3}>Claimed & Paid</option>
                      </select>
                    </label>
                  </div>

                  <div className="update-backend-form-row">
                    <label>
                      <span>Date Dropped:</span>
                      <input
                        type="text"
                        placeholder="2025-11-10 03:20 PM"
                        value={editForm!.dateDropped}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm!,
                            dateDropped: e.target.value,
                          })
                        }
                      />
                      <small>Format: YYYY-MM-DD HH:MM AM/PM</small>
                    </label>
                  </div>

                  <div className="update-backend-form-row">
                    <label>
                      <span>Date Done:</span>
                      <input
                        type="date"
                        value={editForm!.dateDone}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm!,
                            dateDone: e.target.value,
                          })
                        }
                      />
                      <small>Leave empty to remove</small>
                    </label>
                  </div>

                  <div className="update-backend-form-row">
                    <label>
                      <span>Date Done Time:</span>
                      <input
                        type="datetime-local"
                        value={editForm!.dateDoneTime}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm!,
                            dateDoneTime: e.target.value,
                          })
                        }
                      />
                      <small>ISO timestamp (leave empty to remove)</small>
                    </label>
                  </div>

                  <div className="update-backend-form-row">
                    <label>
                      <span>Date Paid:</span>
                      <input
                        type="date"
                        value={editForm!.datePaid}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm!,
                            datePaid: e.target.value,
                          })
                        }
                      />
                      <small>Leave empty to remove</small>
                    </label>
                  </div>

                  <div className="update-backend-form-row">
                    <label>
                      <span>Date Paid Time:</span>
                      <input
                        type="datetime-local"
                        value={editForm!.datePaidTime}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm!,
                            datePaidTime: e.target.value,
                          })
                        }
                      />
                      <small>ISO timestamp (leave empty to remove)</small>
                    </label>
                  </div>

                  {saveMessage && (
                    <div
                      className={`update-backend-message ${
                        saveMessage.includes('✅') ? 'success' : 'error'
                      }`}
                    >
                      {saveMessage}
                    </div>
                  )}

                  <div className="update-backend-form-actions">
                    <button
                      type="button"
                      className="btn-control-primary"
                      onClick={() => handleSave(record.id)}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <div className="spinner-small" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn-control-secondary"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="update-backend-view">
                  <div className="update-backend-view-header">
                    <div className="update-backend-view-name-wrapper">
                      <h3>{record.customerName}</h3>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn-control-secondary"
                          onClick={() => startEdit(record)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-control-danger"
                          onClick={() => requestDelete(record.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="update-backend-view-details">
                    <div>
                      <strong>Status:</strong> <span>{record.status === 1 ? 'In Progress' : record.status === 2 ? 'Done' : 'Claimed & Paid'}</span>
                    </div>
                    <div>
                      <strong>Date Dropped:</strong> <span>{record.dateDropped || '—'}</span>
                    </div>
                    <div>
                      <strong>Date Done:</strong> <span>{record.dateDone || '—'}</span>
                    </div>
                    <div>
                      <strong>Date Done Time:</strong> <span>{record.dateDoneTime || '—'}</span>
                    </div>
                    {record.doneBy && (
                      <div>
                        <strong>Done By:</strong> <span>{record.doneBy}</span>
                      </div>
                    )}
                    <div>
                      <strong>Date Paid:</strong> <span>{record.datePaid || '—'}</span>
                    </div>
                    <div>
                      <strong>Date Paid Time:</strong> <span>{record.datePaidTime || '—'}</span>
                    </div>
                    {record.paidBy && (
                      <div>
                        <strong>Paid By:</strong> <span>{record.paidBy}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            ))}

            {totalPages > 1 && (
              <div className="update-backend-pagination">
                <button
                  type="button"
                  className="update-backend-pagination-btn"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <div className="update-backend-pagination-numbers">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      className={`update-backend-pagination-number ${
                        currentPage === page ? 'active' : ''
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="update-backend-pagination-btn"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showDeleteConfirm && deletingId && (
        <div className="modal-backdrop" onClick={cancelDelete}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Customer Record</h3>
            <p>
              Are you sure you want to delete this customer record? This action cannot be undone.
            </p>
            {deleteMessage && (
              <div
                className={`update-backend-message ${
                  deleteMessage.includes('✅') ? 'success' : 'error'
                }`}
                style={{ marginTop: '12px', marginBottom: '12px' }}
              >
                {deleteMessage}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={cancelDelete}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-control-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="spinner-small" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

