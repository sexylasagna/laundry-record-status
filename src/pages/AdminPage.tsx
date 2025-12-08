import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWorker } from 'tesseract.js';
import { CustomerRecord, ReminderEnrichedItem, ReminderItem, ReminderType } from '../types';
import { fetchCustomers, updateCustomerStatus, updateCustomerName, updateTotalWeight } from '../services/sheetsService';
import { subscribeToReminderNotification, clearReminderNotification, subscribeToAttentionNote, clearAttentionNote, AttentionNotePayload, subscribeToSyncControl, type SyncControlPayload, parseOCRText, addCustomerRecordFromOCR } from '../services/firestoreService';
import { fetchReceiptsWithCustomers } from '../services/loyverseService';
import StatusBadge from '../components/StatusBadge';
import AdminSearchBar from '../components/AdminSearchBar';
import PasswordModal from '../components/PasswordModal';
import { useAdminAuth } from '../context/AdminAuthContext';

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, '0');
  const day = `${today.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`; // YYYY-MM-DD in local time
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

// Format date to "November 1, 2025" format
function formatDateDisplay(dateString: string): string {
  if (!dateString || !dateString.trim()) {
    return '-';
  }

  const trimmed = dateString.trim();
  let date: Date;

  // Handle ISO format or date with time
  if (trimmed.includes('T')) {
    date = new Date(trimmed);
  } else {
    // Handle "2025-10-27 08:25 PM" or "2025-10-27"
    const datePart = trimmed.split(' ')[0];
    date = new Date(datePart);
  }

  if (Number.isNaN(date.getTime())) {
    return trimmed; // Return original if parsing fails
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
  const { user } = useAdminAuth();
  const [rows, setRows] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [tableViewMode, setTableViewMode] = useState<'normal' | 'simple'>(() => {
    try {
      const saved = localStorage.getItem('kwiksilver:table_view_mode');
      return (saved === 'simple' || saved === 'normal') ? saved : 'normal';
    } catch {
      return 'normal';
    }
  });

  const handleTableViewModeChange = (mode: 'normal' | 'simple') => {
    setTableViewMode(mode);
    try {
      localStorage.setItem('kwiksilver:table_view_mode', mode);
    } catch (error) {
      console.error('Failed to save table view mode to localStorage:', error);
    }
  };

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editingField, setEditingField] = useState<'name' | 'weight' | null>(null);
  // const [showOverrideModal, setShowOverrideModal] = useState(false); // Commented out - no longer needed since override access is controlled by isAdmin
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());
  const [reminderItems, setReminderItems] = useState<ReminderEnrichedItem[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderCreatedAt, setReminderCreatedAt] = useState<string | null>(null);
  const [reminderRawItems, setReminderRawItems] = useState<ReminderItem[]>([]);
  const [attentionNote, setAttentionNote] = useState<AttentionNotePayload | null>(null);
  const [showAttentionNoteModal, setShowAttentionNoteModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'done' | 'claimed' | null>(null);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const [showNotAuthorizedModal, setShowNotAuthorizedModal] = useState(false);
  const [syncControl, setSyncControlState] = useState<SyncControlPayload | null>(null);
  const [showCubeView, setShowCubeView] = useState(false);
  const [cubeActionCustomerId, setCubeActionCustomerId] = useState<string | null>(null);
  const [showSyncConfirmModal, setShowSyncConfirmModal] = useState(false);
  const [processingOCR, setProcessingOCR] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [ocrExtractedText, setOcrExtractedText] = useState<string>('');
  const [ocrCustomerName, setOcrCustomerName] = useState<string>('');
  const [ocrTotalWeight, setOcrTotalWeight] = useState<string>('');
  const [ocrModalError, setOcrModalError] = useState<string | null>(null);
  // Compute effective sync enabled flag:
  // - If override exists -> follow override.enabled
  // - If no override -> follow env default (VITE_ENABLE_SYNC_BUTTON)
  const envSyncDefaultEnabled = import.meta.env.VITE_ENABLE_SYNC_BUTTON !== 'false';
  const isSyncEnabled = syncControl ? syncControl.enabled : envSyncDefaultEnabled;

  // Customers for cube view: In Progress (status 1) and Done but not yet Claimed (status 2)
  const cubeViewCustomers = useMemo(
    () =>
      rows.filter((r) => r.status === 1 || r.status === 2),
    [rows]
  );
  const closeReminderModal = useCallback(() => {
    setShowReminderModal(false);
  }, []);

  const dismissAttentionNote = useCallback(async () => {
    setShowAttentionNoteModal(false);
    setAttentionNote(null);
    try {
      await clearAttentionNote();
    } catch (error) {
      console.error('Failed to clear attention note:', error);
    }
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
    const unsubscribe = subscribeToAttentionNote((payload) => {
      if (payload && payload.note && payload.note.trim()) {
        setAttentionNote(payload);
        setShowAttentionNoteModal(true);
      } else {
        setAttentionNote(null);
        setShowAttentionNoteModal(false);
      }
    });
    return unsubscribe;
  }, []);

  // Subscribe to sync control override (enable/disable sync button)
  useEffect(() => {
    const unsubscribe = subscribeToSyncControl((payload) => {
      console.log('🔄 Sync control updated:', payload);
      console.log('🔄 Sync button should be:', payload === null || payload.enabled === true ? 'ENABLED' : 'DISABLED');
      setSyncControlState(payload);
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

  const handleConfirmAction = useCallback(async () => {
    if (!confirmationId || !confirmationAction) return;
    
    setShowConfirmationModal(false);
    const id = confirmationId;
    const action = confirmationAction;
    setConfirmationId(null);
    setConfirmationAction(null);
    setCubeActionCustomerId(null);
    const userName = user?.name || 'Unknown';

    if (action === 'done') {
      const nowTimestamp = getCurrentTimestamp();
      const today = nowTimestamp.split('T')[0];
      const updated = await updateCustomerStatus(id, 2, undefined, today, undefined, nowTimestamp, userName);
      setRows(updated);
    } else if (action === 'claimed') {
      const nowTimestamp = getCurrentTimestamp();
      const today = nowTimestamp.split('T')[0];
      const recordToUpdate = rows.find((r) => r.id === id);
      const dateDone = extractDateOnly(recordToUpdate?.dateDone) || today;
      const dateDoneTime = recordToUpdate?.dateDoneTime || toIsoTimestamp(recordToUpdate?.dateDone) || nowTimestamp;
      const updated = await updateCustomerStatus(id, 3, today, dateDone, nowTimestamp, dateDoneTime, undefined, userName);
      setRows(updated);
    }
  }, [confirmationId, confirmationAction, rows, user]);

  const handleCancelAction = useCallback(() => {
    setShowConfirmationModal(false);
    setConfirmationId(null);
    setConfirmationAction(null);
    setCubeActionCustomerId(null);
  }, []);

  const requestMarkDone = useCallback((id: string) => {
    setConfirmationId(id);
    setConfirmationAction('done');
    setShowConfirmationModal(true);
  }, []);

  const requestMarkClaimed = useCallback((id: string) => {
    setConfirmationId(id);
    setConfirmationAction('claimed');
    setShowConfirmationModal(true);
  }, []);

  const openCubeActionModal = useCallback((id: string) => {
    setCubeActionCustomerId(id);
  }, []);

  const requestMarkDoneFromReminder = useCallback((id: string) => {
    setShowReminderModal(false);
    setConfirmationId(id);
    setConfirmationAction('done');
    setShowConfirmationModal(true);
  }, []);

  const requestMarkClaimedFromReminder = useCallback((id: string) => {
    setShowReminderModal(false);
    setConfirmationId(id);
    setConfirmationAction('claimed');
    setShowConfirmationModal(true);
  }, []);

  const markDone = useCallback(async (id: string) => {
    const nowTimestamp = getCurrentTimestamp();
    const today = nowTimestamp.split('T')[0];
    const userName = user?.name || 'Unknown';
    const updated = await updateCustomerStatus(id, 2, undefined, today, undefined, nowTimestamp, userName);
    setRows(updated);
  }, [user]);

  const markClaimed = useCallback(async (id: string) => {
    const nowTimestamp = getCurrentTimestamp();
    const today = nowTimestamp.split('T')[0];
    const recordToUpdate = rows.find((r) => r.id === id);
    const dateDone = extractDateOnly(recordToUpdate?.dateDone) || today;
    const dateDoneTime = recordToUpdate?.dateDoneTime || toIsoTimestamp(recordToUpdate?.dateDone) || nowTimestamp;
    const userName = user?.name || 'Unknown';
    const updated = await updateCustomerStatus(id, 3, today, dateDone, nowTimestamp, dateDoneTime, undefined, userName);
    setRows(updated);
  }, [rows, user]);

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
            const userName = user?.name || 'Unknown';
            await updateCustomerStatus(
              matchingRecord.id,
              3,
              receiptDate,
              recordDateDone,
              receiptTimestamp,
              recordDateDoneTime,
              undefined,
              userName
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setOcrMessage('❌ Please select an image file.');
      setTimeout(() => setOcrMessage(null), 3000);
      return;
    }

    // Validate file size (max 10MB for OCR)
    if (file.size > 10 * 1024 * 1024) {
      setOcrMessage('❌ Image size must be less than 10MB.');
      setTimeout(() => setOcrMessage(null), 3000);
      return;
    }

    setProcessingOCR(true);
    setOcrMessage('Processing image with OCR...');

    try {
      // Create a worker for OCR
      const worker = await createWorker('eng');
      
      // Perform OCR on the image
      const { data: { text } } = await worker.recognize(file);
      
      // Log extracted text to console
      console.log('=== OCR Extracted Text ===');
      console.log(text);
      console.log('=== End of OCR Text ===');
      
      // Store extracted text
      setOcrExtractedText(text);
      
      // Parse OCR text to extract customer data
      const parsedData = parseOCRText(text);
      
      // Set parsed data or empty strings if parsing failed
      if (parsedData) {
        setOcrCustomerName(parsedData.customerName);
        setOcrTotalWeight(parsedData.totalWeightKg.toString());
        console.log('=== Parsed OCR Data ===');
        console.log('Customer Name:', parsedData.customerName);
        console.log('Total Weight (kg):', parsedData.totalWeightKg);
        console.log('=== End of Parsed Data ===');
      } else {
        // If parsing failed, allow manual input
        setOcrCustomerName('');
        setOcrTotalWeight('');
        console.log('⚠️ Could not parse OCR text, allowing manual input');
      }
      
      // Terminate the worker
      await worker.terminate();
      
      // Open the confirmation modal
      setShowOCRModal(true);
      setOcrMessage(null);
    } catch (error) {
      console.error('Error processing OCR:', error);
      setOcrMessage(`❌ Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setOcrMessage(null), 5000);
    } finally {
      setProcessingOCR(false);
    }
  };

  const handleOCRSubmit = async () => {
    // Clear previous errors
    setOcrModalError(null);
    
    // Validate inputs
    if (!ocrCustomerName.trim() || !ocrTotalWeight.trim()) {
      setOcrModalError('❌ Please fill up all mandatory fields (Customer Name and Total Weight).');
      return;
    }

    const weight = parseFloat(ocrTotalWeight);
    if (isNaN(weight) || weight <= 0) {
      setOcrModalError('❌ Please enter a valid weight (positive number).');
      return;
    }

    try {
      // Get sender name from logged-in user
      const senderName = user?.username || user?.name || 'Unknown';
      
      // Create parsed data object
      const parsedData = {
        customerName: ocrCustomerName.trim(),
        totalWeightKg: weight,
        extractedText: ocrExtractedText,
      };
      
      // Add customer record to Firestore
      await addCustomerRecordFromOCR(parsedData, senderName);
      
      setOcrMessage(`✅ Customer record added: ${parsedData.customerName} (${parsedData.totalWeightKg}kg)`);
      setTimeout(() => setOcrMessage(null), 5000);
      
      // Refresh customer list
      const refreshedData = await fetchCustomers();
      setRows(refreshedData);
      
      // Close modal and reset
      handleOCRCancel();
    } catch (error) {
      console.error('Error adding customer record:', error);
      setOcrMessage(`❌ Failed to add customer record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setOcrMessage(null), 5000);
    }
  };

  const handleOCRCancel = () => {
    setShowOCRModal(false);
    setOcrExtractedText('');
    setOcrCustomerName('');
    setOcrTotalWeight('');
    setOcrModalError(null);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
                        onClick={() => requestMarkDoneFromReminder(record.id)}
                        disabled={record.status !== 1}
                      >
                        Done
                      </button>
                      <button
                        className="btn btn-claimed"
                        onClick={() => requestMarkClaimedFromReminder(record.id)}
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
      {showNotAuthorizedModal && (
        <div className="modal-backdrop" onClick={() => setShowNotAuthorizedModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Not authorized</h3>
            <p>You're not authorized to access the override controls.</p>
            <div className="modal-actions">
              <button
                className="btn primary"
                type="button"
                onClick={() => setShowNotAuthorizedModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showAttentionNoteModal && attentionNote && (
        <div
          className="attention-note-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="attention-note-title"
          onClick={dismissAttentionNote}
        >
          <div className="attention-note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="attention-note-header">
              <h3 id="attention-note-title">Attention</h3>
              <button
                className="attention-note-close"
                onClick={dismissAttentionNote}
                aria-label="Close attention note"
              >
                ×
              </button>
            </div>
            {attentionNote.createdAt && (
              <div className="attention-note-meta">
                Sent {new Date(attentionNote.createdAt).toLocaleString()}
                {attentionNote.sentBy && ` • Sent by: ${attentionNote.sentBy}`}
              </div>
            )}
            <div className="attention-note-content">
              <p>{attentionNote.note}</p>
            </div>
            <div className="attention-note-footer">
              <button className="btn btn-claimed" onClick={dismissAttentionNote}>
                Got it, understood
              </button>
            </div>
          </div>
        </div>
      )}
      {showConfirmationModal && (
        <div className="modal-backdrop" onClick={handleCancelAction}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Are you sure?</h3>
            <p>
              {confirmationAction === 'done'
                ? 'Are you sure you want to mark this record as Done?'
                : 'Are you sure you want to mark this record as Claimed & Paid?'}
            </p>
            <div className="modal-actions">
              <button className="btn ghost" onClick={handleCancelAction}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleConfirmAction}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
      {showSyncConfirmModal && (
        <div className="modal-backdrop" onClick={() => setShowSyncConfirmModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Are you sure?</h3>
            <p>Are you sure you want to sync with Loyverse receipts?</p>
            <div className="modal-actions">
              <button
                className="btn ghost"
                onClick={() => setShowSyncConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  setShowSyncConfirmModal(false);
                  void handleSync();
                }}
              >
                Yes, sync now
              </button>
            </div>
          </div>
        </div>
      )}
      {cubeActionCustomerId && (
        <div className="modal-backdrop" onClick={() => setCubeActionCustomerId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Update status</h3>
            <p>Choose what you want to do for this customer.</p>
            <div className="modal-actions modal-actions-stacked">
              <button
                className="btn ghost"
                onClick={() => setCubeActionCustomerId(null)}
              >
                Cancel
              </button>
              {rows.find((r) => r.id === cubeActionCustomerId)?.status === 1 && (
                <button
                  className="btn"
                  onClick={() => {
                    setCubeActionCustomerId(null);
                    setConfirmationId(cubeActionCustomerId);
                    setConfirmationAction('done');
                    setShowConfirmationModal(true);
                  }}
                >
                  Mark as Done
                </button>
              )}
              <button
                className="btn btn-claimed"
                onClick={() => {
                  setCubeActionCustomerId(null);
                  setConfirmationId(cubeActionCustomerId);
                  setConfirmationAction('claimed');
                  setShowConfirmationModal(true);
                }}
              >
                Paid &amp; Claimed
              </button>
            </div>
          </div>
        </div>
      )}
      {showOCRModal && (
        <div className="modal-backdrop" onClick={handleOCRCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
            <h3>Confirm Customer Information</h3>
            {(!ocrCustomerName.trim() && !ocrTotalWeight.trim()) && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '12px',
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  color: '#dc2626',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                ❌ Unable to read the name and total weight from the image. Please supply the information below.
              </div>
            )}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                Extracted Text:
              </label>
              <div
                style={{
                  padding: '12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--muted)',
                }}
              >
                {ocrExtractedText || 'No text extracted'}
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                Customer Name: *
              </label>
              <input
                type="text"
                value={ocrCustomerName}
                onChange={(e) => {
                  setOcrCustomerName(e.target.value);
                  if (ocrModalError) setOcrModalError(null);
                }}
                placeholder="Enter customer name"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                Total Weight (kg): *
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={ocrTotalWeight}
                onChange={(e) => {
                  setOcrTotalWeight(e.target.value);
                  if (ocrModalError) setOcrModalError(null);
                }}
                placeholder="Enter total weight"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
            </div>
            <div style={{ marginBottom: '20px', padding: '10px', background: 'var(--surface)', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                Uploaded by:
              </label>
              <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
                {user?.name || user?.username || 'Unknown'}
              </span>
            </div>
            {ocrModalError && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '12px',
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: '8px',
                  color: '#dc2626',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                {ocrModalError}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn ghost" onClick={handleOCRCancel}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleOCRSubmit}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      <h2>{user?.name ? `Hi ${user.name}, this is Kwiksilver Laundry Record Status` : 'Kwiksilver Laundry Record Status'}</h2>
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
            if (user?.isAdmin) {
              navigate('/override');
            } else {
              setShowNotAuthorizedModal(true);
            }
          }}
        >
          Override
        </button>
        <button
          className="btn-portal"
          onClick={() => navigate('/portal')}
        >
          Portal
        </button>
      </div>
      {/* Commented out - no longer needed since override access is controlled by isAdmin */}
      {/* {showOverrideModal && (
        <PasswordModal
          onClose={() => setShowOverrideModal(false)}
          passwordType="override"
        />
      )} */}
      {!loading && (
        <>
          <div className="admin-controls">
            <AdminSearchBar value={searchQuery} onChange={setSearchQuery} />
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              disabled={processingOCR}
              style={{ display: 'none' }}
              id="image-ocr-input"
            />
            <label
              htmlFor="image-ocr-input"
              className="btn-upload-ocr"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: processingOCR
                  ? 'var(--muted)'
                  : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                border: '1px solid #4f46e5',
                borderRadius: '8px',
                cursor: processingOCR ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: '#ffffff',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                position: 'relative',
              }}
            >
              {!processingOCR && (
                <>
                  <div className="glitter-1" />
                  <div className="glitter-2" />
                  <div className="glitter-3" />
                  <div className="glitter-4" />
                  <div className="glitter-5" />
                  <span className="btn-new-badge">New</span>
                </>
              )}
              {processingOCR ? (
                <>
                  <div className="spinner-small" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>Upload</span>
                </>
              )}
            </label>
            {/* Commented out - sync button moved to Override Control page */}
            {/* <button 
              className="sync-btn" 
              onClick={() => setShowSyncConfirmModal(true)} 
              disabled={syncing || !isSyncEnabled}
              title={
                !isSyncEnabled
                  ? 'Sync is disabled by admin or env configuration'
                  : 'Sync with Loyverse receipts'
              }
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
            </button> */}
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
            <div className="table-view-toggle desktop-toggle">
              <button
                type="button"
                className={`table-view-toggle-option ${tableViewMode === 'normal' ? 'active' : ''}`}
                onClick={() => handleTableViewModeChange('normal')}
              >
                Normal
              </button>
              <button
                type="button"
                className={`table-view-toggle-option ${tableViewMode === 'simple' ? 'active' : ''}`}
                onClick={() => handleTableViewModeChange('simple')}
              >
                Simple
              </button>
            </div>
            <button
              type="button"
              className={`cube-view-toggle ${showCubeView ? 'active' : ''}`}
              onClick={() => setShowCubeView((prev) => !prev)}
              title="Toggle simple cube view for In Progress and Done (not claimed)"
            >
              {showCubeView ? 'Hide cubes view' : 'Show cubes view'}
            </button>
          </div>
          {syncMessage && (
            <div className={`sync-message ${syncMessage.includes('✅') ? 'sync-success' : 'sync-info'}`}>
              {syncMessage}
            </div>
          )}
          {ocrMessage && (
            <div className={`sync-message ${ocrMessage.includes('✅') ? 'sync-success' : 'sync-info'}`} style={{ marginTop: '8px' }}>
              {ocrMessage}
            </div>
          )}
          {showCubeView && cubeViewCustomers.length > 0 && (
            <div className="cube-view-grid">
              {cubeViewCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className={`cube-card ${
                    customer.status === 1 ? 'in-progress' : 'done'
                  }`}
                  onClick={() => openCubeActionModal(customer.id)}
                >
                  {customer.customerName}
                </div>
              ))}
            </div>
          )}
          {showCubeView && cubeViewCustomers.length === 0 && (
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
              No In Progress or Done (not claimed) customers to display.
            </div>
          )}
        </>
      )}
      {!loading && !showCubeView && tableViewMode === 'normal' && (
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
                const formattedDate = formatDateDisplay(r.dateDropped);
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
                    <div>{formattedDate}</div>
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
                        onClick={() => requestMarkDone(r.id)}
                        disabled={claimed || done}
                      >
                        Done
                      </button>
                      <button
                        className="btn btn-claimed"
                        onClick={() => requestMarkClaimed(r.id)}
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
      {!loading && !showCubeView && tableViewMode === 'simple' && (
        <div className="table table-simple">
          <div className="thead">
            <div>Date Dropped</div>
            <div>Customer Name</div>
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
                const formattedDate = formatDateDisplay(r.dateDropped);
                return (
                  <div className="tr" key={r.id}>
                    <div>{formattedDate}</div>
                    <div className="customer-name-cell">
                      <span>{r.customerName}</span>
                    </div>
                    <div className="actions">
                      <button
                        className="btn btn-done"
                        onClick={() => requestMarkDone(r.id)}
                        disabled={claimed || done}
                      >
                        Done
                      </button>
                      <button
                        className="btn btn-claimed"
                        onClick={() => requestMarkClaimed(r.id)}
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


