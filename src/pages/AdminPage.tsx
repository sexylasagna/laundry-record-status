import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerRecord, ReminderEnrichedItem, ReminderItem, ReminderType } from '../types';
import { fetchCustomers, updateCustomerStatus, updateCustomerName, updateTotalWeight } from '../services/sheetsService';
import { subscribeToReminderNotification, clearReminderNotification } from '../services/firestoreService';
import { fetchReceiptsWithCustomers } from '../services/loyverseService';
import StatusBadge from '../components/StatusBadge';
import AdminSearchBar from '../components/AdminSearchBar';
import PasswordModal from '../components/PasswordModal';

function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

function toIsoTimestamp(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsedDirect = new Date(trimmed);
  if (!Number.isNaN(parsedDirect.getTime())) {
    return parsedDirect.toISOString();
  }

  const parsedMidnight = new Date(`${trimmed}T00:00:00`);
  if (!Number.isNaN(parsedMidnight.getTime())) {
    return parsedMidnight.toISOString();
  }

  return undefined;
}

// Extract date portion (YYYY-MM-DD) from various date string formats
function extractDateOnly(dateString?: string): string {
  const trimmed = dateString?.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.includes('T')) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return trimmed.split('T')[0];
  }

  return trimmed.split(' ')[0];
}

// Parse date string to extract date and time separately
function parseDateAndTime(dateString: string): { date: string; time: string } {
  const trimmed = dateString.trim();
  if (!trimmed) {
    return { date: '-', time: '-' };
  }

  if (trimmed.includes('T')) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        date: parsed.toLocaleDateString('en-CA'),
        time: parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    }
  }

  // Handle formats like "2025-10-27 08:25 PM" or "2025-10-27"
  const parts = trimmed.split(' ');
  if (parts.length >= 3) {
    // Has time: "2025-10-27 08:25 PM"
    const date = parts[0];
    const time = parts.slice(1).join(' '); // "08:25 PM"
    return { date, time };
  }
  // No time, just date
  return { date: parts[0] || trimmed, time: '-' };
}

type SortOrder = 'asc' | 'desc' | null;

function getDaysSince(dateString: string | undefined): number {
  if (!dateString) return 0;
  const trimmed = dateString.trim();
  if (!trimmed) return 0;

  let dateOnly = trimmed;
  if (trimmed.includes('T')) {
    dateOnly = trimmed.split('T')[0];
  } else if (trimmed.includes(' ')) {
    dateOnly = trimmed.split(' ')[0];
  }

  const parsed = new Date(dateOnly);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  const normalized = new Date(parsed);
  normalized.setHours(0, 0, 0, 0);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const diff = now.getTime() - normalized.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function recordStillQualifies(record: CustomerRecord, type: ReminderType): boolean {
  const daysSinceDropped = getDaysSince(record.dateDropped);
  if (type === 'in-progress') {
    return record.status === 1 && daysSinceDropped >= 2;
  }
  if (type === 'done') {
    if (record.status !== 2) {
      return false;
    }
    if (record.dateDone) {
      const daysSinceDone = getDaysSince(record.dateDone);
      return daysSinceDone > 3;
    }
    return daysSinceDropped > 3;
  }
  return false;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editingField, setEditingField] = useState<'name' | 'weight' | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());
  const [reminderItems, setReminderItems] = useState<ReminderEnrichedItem[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderCreatedAt, setReminderCreatedAt] = useState<string | null>(null);
  const [reminderRawItems, setReminderRawItems] = useState<ReminderItem[]>([]);
  const closeReminderModal = useCallback(() => {
    setShowReminderModal(false);
  }, []);

  const dismissReminder = useCallback(async () => {
    setShowReminderModal(false);
    setReminderItems([]);
    setReminderRawItems([]);
    setReminderCreatedAt(null);
    setExpandedRows((prev) => {
      if (reminderItems.length === 0) {
        return prev;
      }
      const next = new Set(prev);
      reminderItems.forEach((item) => next.delete(item.record.id));
      return next;
    });
    try {
      await clearReminderNotification();
    } catch (error) {
      console.error('Failed to clear reminder notification:', error);
    }
  }, [reminderItems]);

  useEffect(() => {
    fetchCustomers().then((data) => {
      setRows(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setExpandedRows((prev) => {
      const next = new Set<string>();
      rows.forEach((row) => {
        if (row.status === 3 && prev.has(row.id)) {
          next.add(row.id);
        }
      });
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  useEffect(() => {
    const unsubscribe = subscribeToReminderNotification((payload) => {
      if (payload && Array.isArray(payload.items) && payload.items.length > 0) {
        setReminderRawItems(payload.items);
        setReminderCreatedAt(payload.createdAt || null);
      } else {
        setReminderRawItems([]);
        setReminderCreatedAt(null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (reminderRawItems.length === 0) {
      setReminderItems([]);
      setShowReminderModal(false);
      return;
    }

    const enriched = reminderRawItems
      .map<ReminderEnrichedItem | null>((item) => {
        const record = rows.find((r) => r.id === item.id);
        if (!record) {
          return null;
        }
        if (!recordStillQualifies(record, item.type)) {
          return null;
        }
        return {
          ...item,
          record,
          daysSinceDropped: getDaysSince(record.dateDropped),
          daysSinceDone: record.dateDone ? getDaysSince(record.dateDone) : undefined,
        };
      })
      .filter((item): item is ReminderEnrichedItem => item !== null);

    if (enriched.length === 0) {
      setReminderItems([]);
      setShowReminderModal(false);
      void (async () => {
        try {
          await clearReminderNotification();
        } catch (error) {
          console.error('Failed to clear stale reminder notification:', error);
        }
      })();
      return;
    }

    setReminderItems(enriched);
    setShowReminderModal(true);
  }, [reminderRawItems, rows, loading]);

  // Filter records: show "In progress" (1), "Done" (2), or "Claimed & Paid" (3) with today's date
  const filteredRows = useMemo(() => {
    const today = getTodayDate();
    return rows.filter((r) => {
      // Show if status is "In progress" (1)
      if (r.status === 1) return true;
      // Show if status is "Done" (2)
      if (r.status === 2) return true;
      // Show if "Claimed & Paid" (3) and datePaid is today
      if (r.status === 3 && extractDateOnly(r.datePaid) === today) return true;
      // Hide "Claimed & Paid" from previous days
      return false;
    });
  }, [rows]);

  // Apply search filter and sorting
  const displayRows = useMemo(() => {
    let result = filteredRows;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) =>
        r.customerName.toLowerCase().includes(q)
      );
    }
    
    // Apply sorting by date and time
    if (sortOrder) {
      result = [...result].sort((a, b) => {
        // Parse date and time for comparison
        const parseDate = (dateStr: string): Date => {
          // Handle format like "2025-10-27 08:25 PM"
          const parts = dateStr.trim().split(' ');
          const datePart = parts[0]; // "2025-10-27"
          const timePart = parts.slice(1).join(' '); // "08:25 PM"
          
          if (!timePart || timePart === '-') {
            // No time, just date
            return new Date(datePart);
          }
          
          // Parse time (format: "08:25 PM")
          const [time, period] = timePart.split(' ');
          const [hours, minutes] = time.split(':').map(Number);
          let hour24 = hours;
          if (period === 'PM' && hours !== 12) hour24 = hours + 12;
          if (period === 'AM' && hours === 12) hour24 = 0;
          
          const date = new Date(datePart);
          date.setHours(hour24, minutes, 0, 0);
          return date;
        };
        
        const dateA = parseDate(a.dateDropped);
        const dateB = parseDate(b.dateDropped);
        
        if (sortOrder === 'asc') {
          return dateA.getTime() - dateB.getTime();
        } else {
          return dateB.getTime() - dateA.getTime();
        }
      });
    }
    
    return result;
  }, [filteredRows, searchQuery, sortOrder]);

  const handleSort = () => {
    if (sortOrder === null) {
      setSortOrder('desc'); // Newest first
    } else if (sortOrder === 'desc') {
      setSortOrder('asc'); // Oldest first
    } else {
      setSortOrder(null); // No sort
    }
  };

  const markDone = useCallback(async (id: string) => {
    const nowTimestamp = getCurrentTimestamp();
    const today = nowTimestamp.split('T')[0];
    const updated = await updateCustomerStatus(id, 2, undefined, today, undefined, nowTimestamp);
    setRows(updated);
  }, []);

  const markClaimed = useCallback(async (id: string) => {
    const nowTimestamp = getCurrentTimestamp();
    const today = nowTimestamp.split('T')[0];
    const recordToUpdate = rows.find((r) => r.id === id);
    const dateDone = extractDateOnly(recordToUpdate?.dateDone) || today;
    const dateDoneTime = recordToUpdate?.dateDoneTime || toIsoTimestamp(recordToUpdate?.dateDone) || nowTimestamp;
    const updated = await updateCustomerStatus(id, 3, today, dateDone, nowTimestamp, dateDoneTime);
    setRows(updated);
  }, [rows]);

  const startEdit = (id: string, field: 'name' | 'weight', currentValue: string | number) => {
    setEditingId(id);
    setEditingField(field);
    setEditValue(String(currentValue));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
    setEditingField(null);
  };

  const saveEdit = async (id: string) => {
    if (editingField === 'name') {
      if (!editValue.trim()) {
        cancelEdit();
        return;
      }
      
      try {
        const updated = await updateCustomerName(id, editValue.trim());
        setRows(updated);
        cancelEdit();
      } catch (error) {
        console.error('Error updating customer name:', error);
        alert('Failed to update customer name. Please try again.');
      }
    } else if (editingField === 'weight') {
      const weight = parseFloat(editValue);
      if (isNaN(weight) || weight < 0) {
        alert('Please enter a valid weight (positive number)');
        return;
      }
      
      try {
        const updated = await updateTotalWeight(id, weight);
        setRows(updated);
        cancelEdit();
      } catch (error) {
        console.error('Error updating total weight:', error);
        alert('Failed to update total weight. Please try again.');
      }
    }
  };

  // Sync with Loyverse receipts
  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    
    try {
      console.log('🔄 Starting sync with Loyverse...');
      
      // Fetch receipts from Loyverse (last 1 day)
      const receipts = await fetchReceiptsWithCustomers(1);
      console.log(`📊 Found ${receipts.length} receipts from Loyverse`);
      
      if (receipts.length === 0) {
        setSyncMessage('No recent receipts found in Loyverse.');
        setSyncing(false);
        return;
      }

      // Get all records with status = 2 (Done)
      const doneRecords = rows.filter(r => r.status === 2);
      console.log(`📋 Found ${doneRecords.length} records with status "Done"`);

      let matchedCount = 0;
      let updatedCount = 0;
      const updatedRecords: Array<{ id: string; customerName: string; receiptDate: string }> = [];

      // Match receipts with Firestore records
      for (const receipt of receipts) {
        // Find matching record: status = 2, matching customer name, and receipt date >= dropped date
        const matchingRecord = doneRecords.find(r => {
          const recordDate = extractDateOnly(r.dateDropped);
          const customerNameMatch = r.customerName.toLowerCase().trim() === receipt.customerName.toLowerCase().trim();
          
          // Receipt date should be later than or equal to the record's dropped date
          const receiptDateObj = new Date(receipt.receiptDate);
          const recordDateObj = new Date(recordDate);
          const dateMatch = receiptDateObj >= recordDateObj;
          
          return customerNameMatch && dateMatch && r.status === 2;
        });

        if (matchingRecord) {
          matchedCount++;
          // Check if already claimed (shouldn't happen but safety check)
          if (matchingRecord.status !== 3) {
            console.log(`✅ Matched: ${matchingRecord.customerName} on ${receipt.receiptDate}`);
            // Update to status = 3 (Claimed & Paid) with receipt date
            const receiptDate = extractDateOnly(receipt.receiptDate);
            const receiptTimestamp = toIsoTimestamp(receipt.receiptDate) || getCurrentTimestamp();
            const recordDateDone = extractDateOnly(matchingRecord.dateDone) || extractDateOnly(matchingRecord.dateDropped);
            const recordDateDoneTime =
              matchingRecord.dateDoneTime ||
              toIsoTimestamp(matchingRecord.dateDone) ||
              toIsoTimestamp(matchingRecord.dateDropped) ||
              receiptTimestamp;
            await updateCustomerStatus(
              matchingRecord.id,
              3,
              receiptDate,
              recordDateDone,
              receiptTimestamp,
              recordDateDoneTime
            );
            updatedCount++;
            updatedRecords.push({
              id: matchingRecord.id,
              customerName: matchingRecord.customerName,
              receiptDate: receiptTimestamp,
            });
          }
        }
      }

      // Refresh data from Firestore
      const refreshedData = await fetchCustomers();
      setRows(refreshedData);

      if (matchedCount === 0) {
        setSyncMessage(`No matches found. Checked ${receipts.length} receipts against ${doneRecords.length} done records.`);
      } else {
        setSyncMessage(`✅ Sync complete! Matched ${matchedCount} receipts, updated ${updatedCount} records.`);
      }

      console.log(`✅ Sync complete: ${updatedCount} records updated`);
      if (updatedRecords.length > 0) {
        console.log('📋 Updated records details:', updatedRecords);
      } else {
        console.log('ℹ️ No records were updated during this sync.');
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
      setSyncMessage(`Error syncing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const toggleRowExpanded = (recordId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const handleRowClick = (
    event: React.MouseEvent<HTMLDivElement>,
    recordId: string,
    isClaimed: boolean
  ) => {
    if (!isClaimed) {
      return;
    }
    if (typeof window !== 'undefined') {
      const isMobile = window.matchMedia('(max-width: 720px)').matches;
      if (!isMobile) {
        return;
      }
    }
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) {
      return;
    }
    toggleRowExpanded(recordId);
  };

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    recordId: string,
    isClaimed: boolean
  ) => {
    if (!isClaimed) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if (typeof window !== 'undefined') {
      const isMobile = window.matchMedia('(max-width: 720px)').matches;
      if (!isMobile) {
        return;
      }
    }
    event.preventDefault();
    toggleRowExpanded(recordId);
  };

  return (
    <div className="admin-page">
      {showReminderModal && reminderItems.length > 0 && (
        <div
          className="reminder-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reminder-title"
          onClick={closeReminderModal}
        >
          <div className="reminder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reminder-modal-header">
              <h3 id="reminder-title">Reminding to update customers below:</h3>
              <button
                className="reminder-close"
                onClick={closeReminderModal}
                aria-label="Close reminder"
              >
                ×
              </button>
            </div>
            {reminderCreatedAt && (
              <div className="reminder-meta">
                Generated {new Date(reminderCreatedAt).toLocaleString()}
              </div>
            )}
            <div className="reminder-list">
              {reminderItems.map((item) => {
                const record = item.record;
                const isInProgress = item.type === 'in-progress';
                const daysForMessage = isInProgress
                  ? item.daysSinceDropped
                  : item.daysSinceDone ?? item.daysSinceDropped;
                const reason = isInProgress
                  ? `In progress for ${daysForMessage} day${daysForMessage === 1 ? '' : 's'}`
                  : `Done for ${daysForMessage} day${daysForMessage === 1 ? '' : 's'} but not claimed`;

                return (
                  <div className="reminder-item" key={item.id}>
                    <div className="reminder-item-info">
                      <span className="reminder-item-name">{record.customerName}</span>
                      <span className="reminder-item-reason">{reason}</span>
                      <div className="reminder-item-meta">
                        <StatusBadge status={record.status} />
                        <span>Dropped: {record.dateDropped.split(' ')[0]}</span>
                      </div>
                    </div>
                    <div className="reminder-item-actions">
                      <button
                        className="btn btn-done"
                        onClick={() => markDone(record.id)}
                        disabled={record.status !== 1}
                      >
                        Done
                      </button>
                      <button
                        className="btn btn-claimed"
                        onClick={() => markClaimed(record.id)}
                        disabled={record.status === 3}
                      >
                        Claimed & Paid
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="reminder-footer">
              <button className="btn ghost" onClick={closeReminderModal}>
                Close
              </button>
              <button className="btn btn-claimed" onClick={dismissReminder}>
                Dismiss reminder
              </button>
            </div>
          </div>
        </div>
      )}
      <h2>Kwiksilver Laundry Record Status</h2>
      <div className="header-buttons">
        <button 
          className="btn-my-day"
          onClick={() => navigate('/myday')}
        >
          My day
        </button>
        <button 
          className="btn-override" 
          onClick={() => {
            const authed = localStorage.getItem('overrideAuthed') === 'true';
            if (authed) {
              navigate('/override');
            } else {
              setShowOverrideModal(true);
            }
          }}
        >
          Override Control
        </button>
      </div>
      {showOverrideModal && (
        <PasswordModal
          onClose={() => setShowOverrideModal(false)}
          passwordType="override"
        />
      )}
      {!loading && (
        <>
          <div className="admin-controls">
            <AdminSearchBar value={searchQuery} onChange={setSearchQuery} />
            <button 
              className="sync-btn" 
              onClick={handleSync} 
              disabled={syncing}
              title="Sync with Loyverse receipts"
            >
              {syncing ? (
                <div className="spinner-small" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              )}
              <span>{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>
            <button className="mobile-sort-btn" onClick={handleSort} title="Sort by date">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M7 12h10M11 18h2"></path>
              </svg>
              {sortOrder && (
                <span className="sort-indicator-mobile">
                  {sortOrder === 'desc' ? '↓' : '↑'}
                </span>
              )}
            </button>
          </div>
          {syncMessage && (
            <div className={`sync-message ${syncMessage.includes('✅') ? 'sync-success' : 'sync-info'}`}>
              {syncMessage}
            </div>
          )}
        </>
      )}
      {loading ? (
        <div className="muted">Loading records...</div>
      ) : (
        <div className="table">
          <div className="thead">
            <div>Date Dropped</div>
            <div>Time</div>
            <div>Customer name</div>
            <div>Total Weight (kg)</div>
            <div>Status</div>
            <div>Date Paid & Claimed</div>
            <div>Actions</div>
          </div>
          <div className="tbody">
            {displayRows.length === 0 ? (
              <div className="tr-empty">
                <div>No records found</div>
              </div>
            ) : (
              displayRows.map((r) => {
                const claimed = r.status === 3; // Claimed & Paid
                const done = r.status === 2; // Done
                const { date, time } = parseDateAndTime(r.dateDropped);
                const isExpanded = expandedRows.has(r.id);
                const isCollapsed = claimed && !isExpanded;
                const rowClasses = ['tr'];
                if (claimed) {
                  rowClasses.push('row-claimed', isCollapsed ? 'row-collapsed' : 'row-expanded');
                }
                return (
                  <div
                    className={rowClasses.join(' ')}
                    key={r.id}
                    onClick={(event) => handleRowClick(event, r.id, claimed)}
                    onKeyDown={(event) => handleRowKeyDown(event, r.id, claimed)}
                    role={claimed ? 'button' : undefined}
                    tabIndex={claimed ? 0 : undefined}
                    aria-expanded={claimed ? !isCollapsed : undefined}
                    aria-label={claimed ? `Toggle details for ${r.customerName}` : undefined}
                  >
                    <div>{date}</div>
                    <div>{time}</div>
                    <div className="customer-name-cell">
                      {editingId === r.id && editingField === 'name' ? (
                        <div className="customer-name-edit">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="customer-name-input"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveEdit(r.id);
                              } else if (e.key === 'Escape') {
                                cancelEdit();
                              }
                            }}
                          />
                          <button
                            className="icon-btn save-btn"
                            onClick={() => saveEdit(r.id)}
                            title="Save"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>
                          <button
                            className="icon-btn cancel-btn"
                            onClick={cancelEdit}
                            title="Cancel"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="customer-name-display">
                          <span>{r.customerName}</span>
                          <button
                            className="icon-btn edit-btn"
                            onClick={() => startEdit(r.id, 'name', r.customerName)}
                            title="Edit customer name"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="weight-cell">
                      {editingId === r.id && editingField === 'weight' ? (
                        <div className="customer-name-edit">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="customer-name-input"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveEdit(r.id);
                              } else if (e.key === 'Escape') {
                                cancelEdit();
                              }
                            }}
                          />
                          <button
                            className="icon-btn save-btn"
                            onClick={() => saveEdit(r.id)}
                            title="Save"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>
                          <button
                            className="icon-btn cancel-btn"
                            onClick={cancelEdit}
                            title="Cancel"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="customer-name-display">
                          <span>{r.totalWeightKg}</span>
                          <button
                            className="icon-btn edit-btn"
                            onClick={() => startEdit(r.id, 'weight', r.totalWeightKg)}
                            title="Edit weight"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <StatusBadge status={r.status} />
                    </div>
                    <div>{r.datePaid || '-'}</div>
                    <div className="actions">
                      <button
                        className="btn btn-done"
                        onClick={() => markDone(r.id)}
                        disabled={claimed || done}
                      >
                        Done
                      </button>
                      <button
                        className="btn btn-claimed"
                        onClick={() => markClaimed(r.id)}
                        disabled={claimed}
                      >
                        Claimed & Paid
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}


