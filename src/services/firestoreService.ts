import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { CustomerRecord, LaundryStatus, ReminderPayload } from '../types';

// Map Firestore document to CustomerRecord
function mapFirestoreDoc(docId: string, data: any): CustomerRecord {
  // Extract date_paid if it exists, or derive from timestamp if status is 3
  let datePaid: string | undefined = data.date_paid;
  if (!datePaid && data.status === 3 && data.timestamp) {
    // Convert Firestore timestamp to date string
    const timestamp = data.timestamp;
    let date: Date;
    if (timestamp && typeof timestamp.toDate === 'function') {
      // Firestore Timestamp object
      date = timestamp.toDate();
    } else if (timestamp && timestamp.seconds) {
      // Firestore Timestamp with seconds property
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date();
    }
    datePaid = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
  
  const dateDone: string | undefined = data.date_done || undefined;
  const dateDoneTime: string | undefined = data.date_done_time || undefined;
  const datePaidTime: string | undefined = data.date_paid_time || undefined;

  return {
    id: docId,
    dateDropped: data.date || '', // "2025-11-02 04:47 PM"
    customerName: data.customer_name || '',
    totalWeightKg: Number(data.total_kg) || 0,
    status: (data.status as LaundryStatus) || 1,
    datePaid: datePaid,
    datePaidTime,
    dateDone,
    dateDoneTime,
  };
}

// Fetch all customers from Firestore
export async function fetchCustomersFromFirestore(): Promise<CustomerRecord[]> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    const q = query(collection(db, 'laundry_records'), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    
    console.log(`📊 Found ${querySnapshot.size} documents in laundry_records collection`);
    
    const records: CustomerRecord[] = [];
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      console.log(`📄 Document ${docSnapshot.id}:`, { customer_name: data.customer_name, date: data.date, status: data.status });
      records.push(mapFirestoreDoc(docSnapshot.id, data));
    });
    
    console.log(`✅ Fetched ${records.length} records from Firestore`);
    return records;
  } catch (error) {
    console.error('❌ Error fetching from Firestore:', error);
    throw error;
  }
}

// Update customer status in Firestore
export async function updateCustomerStatusInFirestore(
  docId: string,
  status: LaundryStatus,
  datePaid?: string,
  dateDone?: string,
  datePaidTime?: string,
  dateDoneTime?: string
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    const docRef = doc(db, 'laundry_records', docId);
    const updateData: Record<string, any> = { status };
    
    if (status === 3) {
      if (datePaid) {
        updateData.date_paid = datePaid;
        console.log(`📅 Setting date_paid: ${datePaid} for document ${docId}`);
      }
      if (datePaidTime) {
        updateData.date_paid_time = datePaidTime;
        console.log(`⏱️ Setting date_paid_time: ${datePaidTime} for document ${docId}`);
      }
      if (dateDone) {
        updateData.date_done = dateDone;
        console.log(`📅 Preserving date_done: ${dateDone} for document ${docId}`);
      }
      if (dateDoneTime) {
        updateData.date_done_time = dateDoneTime;
        console.log(`⏱️ Preserving date_done_time: ${dateDoneTime} for document ${docId}`);
      }
    } else if (status === 2) {
      if (dateDone) {
        updateData.date_done = dateDone;
        console.log(`📅 Setting date_done: ${dateDone} for document ${docId}`);
      }
      if (dateDoneTime) {
        updateData.date_done_time = dateDoneTime;
        console.log(`⏱️ Setting date_done_time: ${dateDoneTime} for document ${docId}`);
      }
    }
    
    console.log(`📝 Updating document ${docId} with data:`, updateData);
    await updateDoc(docRef, updateData);
    console.log(`✅ Successfully updated Firestore document ${docId} with status ${status}`);
  } catch (error) {
    console.error(`❌ Error updating Firestore document ${docId}:`, error);
    throw error;
  }
}

// Update customer name in Firestore
export async function updateCustomerNameInFirestore(
  docId: string,
  customerName: string
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    const docRef = doc(db, 'laundry_records', docId);
    const updateData = { customer_name: customerName };
    
    console.log(`📝 Updating customer name for document ${docId} to: ${customerName}`);
    await updateDoc(docRef, updateData);
    console.log(`✅ Successfully updated customer name for document ${docId}`);
  } catch (error) {
    console.error(`❌ Error updating customer name for document ${docId}:`, error);
    throw error;
  }
}

// Update total weight in Firestore
export async function updateTotalWeightInFirestore(
  docId: string,
  totalWeight: number
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    const docRef = doc(db, 'laundry_records', docId);
    const updateData = { total_kg: totalWeight };
    
    console.log(`📝 Updating total weight for document ${docId} to: ${totalWeight} kg`);
    await updateDoc(docRef, updateData);
    console.log(`✅ Successfully updated total weight for document ${docId}`);
  } catch (error) {
    console.error(`❌ Error updating total weight for document ${docId}:`, error);
    throw error;
  }
}

// Update backend data (status, dates, timestamps) in Firestore
export interface UpdateBackendDataParams {
  status: LaundryStatus;
  dateDropped: string;
  dateDone?: string | null;
  dateDoneTime?: string | null;
  datePaid?: string | null;
  datePaidTime?: string | null;
  oldStatus?: LaundryStatus | null;
}

export async function updateBackendDataInFirestore(
  docId: string,
  params: UpdateBackendDataParams
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    const docRef = doc(db, 'laundry_records', docId);
    const updateData: Record<string, any> = {
      status: params.status,
      date: params.dateDropped, // dateDropped is stored as 'date' in Firestore
    };

    const oldStatus = params.oldStatus;
    const newStatus = params.status;

    // Track if fields were removed due to status changes
    const datePaidRemovedByStatus = oldStatus === 3 && newStatus === 2;
    const dateDoneRemovedByStatus = oldStatus === 2 && newStatus === 1;

    // Logic: If status moves from 3 to 2, remove date_claimed and date_claimed_time
    if (datePaidRemovedByStatus) {
      updateData.date_paid = null;
      updateData.date_paid_time = null;
      console.log(`🔄 Status changed from 3 to 2: removing date_paid and date_paid_time`);
    }

    // Logic: If status moves from 2 to 1, remove date_done and date_done_time
    if (dateDoneRemovedByStatus) {
      updateData.date_done = null;
      updateData.date_done_time = null;
      console.log(`🔄 Status changed from 2 to 1: removing date_done and date_done_time`);
    }

    // Handle date_done (only if not removed by status change)
    if (!dateDoneRemovedByStatus) {
      if (params.dateDone === null || params.dateDone === undefined || params.dateDone === '') {
        updateData.date_done = null;
        updateData.date_done_time = null;
        console.log(`🗑️ Removing date_done and date_done_time`);
      } else {
        updateData.date_done = params.dateDone;
        if (params.dateDoneTime) {
          updateData.date_done_time = params.dateDoneTime;
        } else {
          // If dateDone is set but dateDoneTime is not provided, set it to midnight of that date
          updateData.date_done_time = new Date(`${params.dateDone}T00:00:00`).toISOString();
        }
        console.log(`📅 Setting date_done: ${params.dateDone}, date_done_time: ${updateData.date_done_time}`);
      }
    }

    // Handle date_paid (only if not removed by status change)
    if (!datePaidRemovedByStatus) {
      if (params.datePaid === null || params.datePaid === undefined || params.datePaid === '') {
        updateData.date_paid = null;
        updateData.date_paid_time = null;
        console.log(`🗑️ Removing date_paid and date_paid_time`);
      } else {
        updateData.date_paid = params.datePaid;
        if (params.datePaidTime) {
          updateData.date_paid_time = params.datePaidTime;
        } else {
          // If datePaid is set but datePaidTime is not provided, set it to midnight of that date
          updateData.date_paid_time = new Date(`${params.datePaid}T00:00:00`).toISOString();
        }
        console.log(`📅 Setting date_paid: ${params.datePaid}, date_paid_time: ${updateData.date_paid_time}`);
      }
    }

    // Use deleteField() equivalent by setting to null, but Firestore will handle null properly
    // For Firestore, we can use FieldValue.delete() if needed, but null should work for our use case
    
    console.log(`📝 Updating backend data for document ${docId}:`, updateData);
    await updateDoc(docRef, updateData);
    console.log(`✅ Successfully updated backend data for document ${docId}`);
  } catch (error) {
    console.error(`❌ Error updating backend data for document ${docId}:`, error);
    throw error;
  }
}

// Delete a single customer record from Firestore
export async function deleteCustomerRecord(docId: string): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    const docRef = doc(db, 'laundry_records', docId);
    console.log(`🗑️ Deleting customer record ${docId}`);
    await deleteDoc(docRef);
    console.log(`✅ Successfully deleted customer record ${docId}`);
  } catch (error) {
    console.error(`❌ Error deleting customer record ${docId}:`, error);
    throw error;
  }
}

// Delete all records with status = 3 (Claimed & Paid) from Firestore
export async function deleteClaimedAndPaidRecords(): Promise<number> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    // Query all documents with status = 3
    const q = query(collection(db!, 'laundry_records'), where('status', '==', 3));
    const querySnapshot = await getDocs(q);
    
    console.log(`📊 Found ${querySnapshot.size} documents with status = 3 (Claimed & Paid)`);
    
    if (querySnapshot.size === 0) {
      console.log('ℹ️ No records to delete');
      return 0;
    }
    
    // Delete all documents
    const deletePromises = querySnapshot.docs.map((docSnapshot) => {
      const docRef = doc(db!, 'laundry_records', docSnapshot.id);
      console.log(`🗑️ Deleting document ${docSnapshot.id} (${docSnapshot.data().customer_name})`);
      return deleteDoc(docRef);
    });
    
    await Promise.all(deletePromises);
    console.log(`✅ Successfully deleted ${querySnapshot.size} records with status = 3`);
    
    return querySnapshot.size;
  } catch (error) {
    console.error('❌ Error deleting Claimed & Paid records:', error);
    throw error;
  }
}

const REMINDER_COLLECTION = 'laundry_reminder_notification';
const REMINDER_DOC_ID = 'current';

export async function setReminderNotification(payload: ReminderPayload): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  const docRef = doc(db, REMINDER_COLLECTION, REMINDER_DOC_ID);
  await setDoc(docRef, payload);
}

export async function clearReminderNotification(): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  const docRef = doc(db, REMINDER_COLLECTION, REMINDER_DOC_ID);
  await deleteDoc(docRef);
}

export function subscribeToReminderNotification(
  onChange: (payload: ReminderPayload | null) => void
): () => void {
  if (!db) {
    console.warn('Firestore is not initialized; reminder subscription disabled.');
    onChange(null);
    return () => {};
  }
  const docRef = doc(db, REMINDER_COLLECTION, REMINDER_DOC_ID);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      const data = snapshot.data() as ReminderPayload;
      const items = Array.isArray(data.items) ? data.items : [];
      onChange({
        createdAt: data.createdAt,
        items,
      });
    },
    (error) => {
      console.error('❌ Error listening to reminder notification:', error);
      onChange(null);
    }
  );
}

// Attention Note functions
const ATTENTION_NOTE_COLLECTION = 'laundry_attention_note';
const ATTENTION_NOTE_DOC_ID = 'current';

export interface AttentionNotePayload {
  note: string;
  createdAt: string;
  sentBy: string;
}

export async function setAttentionNote(note: string, sentBy: string = 'Nikka'): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  const docRef = doc(db, ATTENTION_NOTE_COLLECTION, ATTENTION_NOTE_DOC_ID);
  const payload: AttentionNotePayload = {
    note: note.trim(),
    createdAt: new Date().toISOString(),
    sentBy: sentBy.trim(),
  };
  await setDoc(docRef, payload);
  console.log('✅ Attention note set in Firestore');
}

export async function clearAttentionNote(): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  const docRef = doc(db, ATTENTION_NOTE_COLLECTION, ATTENTION_NOTE_DOC_ID);
  await deleteDoc(docRef);
  console.log('✅ Attention note cleared from Firestore');
}

export function subscribeToAttentionNote(
  onChange: (payload: AttentionNotePayload | null) => void
): () => void {
  if (!db) {
    console.warn('Firestore is not initialized; attention note subscription disabled.');
    onChange(null);
    return () => {};
  }
  const docRef = doc(db, ATTENTION_NOTE_COLLECTION, ATTENTION_NOTE_DOC_ID);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      const data = snapshot.data() as AttentionNotePayload;
      onChange({
        note: data.note || '',
        createdAt: data.createdAt || new Date().toISOString(),
        sentBy: data.sentBy || 'Nikka',
      });
    },
    (error) => {
      console.error('❌ Error listening to attention note:', error);
      onChange(null);
    }
  );
}

