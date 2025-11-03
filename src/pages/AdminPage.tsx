import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerRecord } from '../types';
import { fetchCustomers, updateCustomerStatus, updateCustomerName, updateTotalWeight } from '../services/sheetsService';
import { fetchReceiptsWithCustomers } from '../services/loyverseService';
import StatusBadge from '../components/StatusBadge';
import AdminSearchBar from '../components/AdminSearchBar';
import PasswordModal from '../components/PasswordModal';

function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Parse date string to extract date and time separately
function parseDateAndTime(dateString: string): { date: string; time: string } {
  // Handle formats like "2025-10-27 08:25 PM" or "2025-10-27"
  const parts = dateString.trim().split(' ');
  if (parts.length >= 3) {
    // Has time: "2025-10-27 08:25 PM"
    const date = parts[0];
    const time = parts.slice(1).join(' '); // "08:25 PM"
    return { date, time };
  }
  // No time, just date
  return { date: parts[0] || dateString, time: '-' };
}

type SortOrder = 'asc' | 'desc' | null;

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

  useEffect(() => {
    fetchCustomers().then((data) => {
      setRows(data);
      setLoading(false);
    });
  }, []);

  // Filter records: show "In progress" (1), "Done" (2), or "Claimed & Paid" (3) with today's date
  const filteredRows = useMemo(() => {
    const today = getTodayDate();
    return rows.filter((r) => {
      // Show if status is "In progress" (1)
      if (r.status === 1) return true;
      // Show if status is "Done" (2)
      if (r.status === 2) return true;
      // Show if "Claimed & Paid" (3) and datePaid is today
      if (r.status === 3 && r.datePaid === today) return true;
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

  const markDone = async (id: string) => {
    const updated = await updateCustomerStatus(id, 2); // Done
    setRows(updated);
  };

  const markClaimed = async (id: string) => {
    const today = getTodayDate();
    const updated = await updateCustomerStatus(id, 3, today); // Claimed & Paid
    setRows(updated);
  };

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

  // Extract date from dateDropped (format: "2025-11-02 04:47 PM" -> "2025-11-02")
  const extractDateOnly = (dateString: string): string => {
    return dateString.split(' ')[0];
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
            await updateCustomerStatus(matchingRecord.id, 3, receipt.receiptDate);
            updatedCount++;
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
    } catch (error) {
      console.error('❌ Sync error:', error);
      setSyncMessage(`Error syncing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="admin-page">
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
                return (
                  <div className="tr" key={r.id}>
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


