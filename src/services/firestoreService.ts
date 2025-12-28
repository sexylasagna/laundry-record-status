import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  setDoc,
  addDoc,
  onSnapshot,
  Timestamp,
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
  const doneBy: string | undefined = data.done_by || undefined;
  const paidBy: string | undefined = data.paid_by || undefined;

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
    doneBy,
    paidBy,
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
  dateDoneTime?: string,
  doneBy?: string,
  paidBy?: string
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
      if (paidBy) {
        updateData.paid_by = paidBy;
        console.log(`👤 Setting paid_by: ${paidBy} for document ${docId}`);
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
      if (doneBy) {
        updateData.done_by = doneBy;
        console.log(`👤 Setting done_by: ${doneBy} for document ${docId}`);
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
  doneBy?: string | null;
  paidBy?: string | null;
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
      updateData.paid_by = null;
      console.log(`🔄 Status changed from 3 to 2: removing date_paid, date_paid_time, and paid_by`);
    }

    // Logic: If status moves from 2 to 1, remove date_done and date_done_time
    if (dateDoneRemovedByStatus) {
      updateData.date_done = null;
      updateData.date_done_time = null;
      updateData.done_by = null;
      console.log(`🔄 Status changed from 2 to 1: removing date_done, date_done_time, and done_by`);
    }

    // Handle date_done (only if not removed by status change)
    if (!dateDoneRemovedByStatus) {
      if (params.dateDone === null || params.dateDone === undefined || params.dateDone === '') {
        updateData.date_done = null;
        updateData.date_done_time = null;
        if (params.doneBy === null || params.doneBy === undefined || params.doneBy === '') {
          updateData.done_by = null;
        }
        console.log(`🗑️ Removing date_done, date_done_time, and done_by`);
      } else {
        updateData.date_done = params.dateDone;
        if (params.dateDoneTime) {
          updateData.date_done_time = params.dateDoneTime;
        } else {
          // If dateDone is set but dateDoneTime is not provided, set it to midnight of that date
          updateData.date_done_time = new Date(`${params.dateDone}T00:00:00`).toISOString();
        }
        if (params.doneBy !== null && params.doneBy !== undefined && params.doneBy !== '') {
          updateData.done_by = params.doneBy;
        }
        console.log(`📅 Setting date_done: ${params.dateDone}, date_done_time: ${updateData.date_done_time}, done_by: ${updateData.done_by || 'not set'}`);
      }
    }

    // Handle date_paid (only if not removed by status change)
    if (!datePaidRemovedByStatus) {
      if (params.datePaid === null || params.datePaid === undefined || params.datePaid === '') {
        updateData.date_paid = null;
        updateData.date_paid_time = null;
        if (params.paidBy === null || params.paidBy === undefined || params.paidBy === '') {
          updateData.paid_by = null;
        }
        console.log(`🗑️ Removing date_paid, date_paid_time, and paid_by`);
      } else {
        updateData.date_paid = params.datePaid;
        if (params.datePaidTime) {
          updateData.date_paid_time = params.datePaidTime;
        } else {
          // If datePaid is set but datePaidTime is not provided, set it to midnight of that date
          updateData.date_paid_time = new Date(`${params.datePaid}T00:00:00`).toISOString();
        }
        if (params.paidBy !== null && params.paidBy !== undefined && params.paidBy !== '') {
          updateData.paid_by = params.paidBy;
        }
        console.log(`📅 Setting date_paid: ${params.datePaid}, date_paid_time: ${updateData.date_paid_time}, paid_by: ${updateData.paid_by || 'not set'}`);
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

// Employee auth (laundry_employees)
export interface LaundryEmployee {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
}

const EMPLOYEE_COLLECTION = 'laundry_employees';

export async function authenticateEmployee(
  username: string,
  password: string
): Promise<LaundryEmployee> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }

  const trimmedUsername = username.trim().toLowerCase();

  if (!trimmedUsername || !password) {
    throw new Error('Username and password are required.');
  }

  const q = query(
    collection(db, EMPLOYEE_COLLECTION),
    where('username', '==', trimmedUsername)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error('Invalid username or password.');
  }

  const docSnapshot = snap.docs[0];
  const data = docSnapshot.data() as any;

  if (typeof data.password !== 'string' || data.password !== password) {
    throw new Error('Invalid username or password.');
  }

  const employee: LaundryEmployee = {
    id: String(data.id ?? docSnapshot.id),
    username: String(data.username ?? trimmedUsername),
    name: String(data.name ?? ''),
    isAdmin: Boolean(data.isAdmin === true),
  };

  return employee;
}

// Get all employees
export async function getAllEmployees(): Promise<LaundryEmployee[]> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }

  try {
    const q = query(collection(db, EMPLOYEE_COLLECTION));
    const snap = await getDocs(q);
    
    const employees: LaundryEmployee[] = [];
    snap.forEach((docSnapshot) => {
      const data = docSnapshot.data() as any;
      employees.push({
        id: String(data.id ?? docSnapshot.id),
        username: String(data.username ?? ''),
        name: String(data.name ?? ''),
        isAdmin: Boolean(data.isAdmin === true),
      });
    });
    
    return employees;
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }
}

// Get next employee ID (incremental from last ID + 1)
export async function getNextEmployeeId(): Promise<string> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }

  try {
    const employees = await getAllEmployees();
    
    if (employees.length === 0) {
      return '1';
    }
    
    // Find the maximum numeric ID
    const numericIds = employees
      .map(emp => {
        const numId = parseInt(emp.id, 10);
        return isNaN(numId) ? 0 : numId;
      })
      .filter(id => id > 0);
    
    if (numericIds.length === 0) {
      return '1';
    }
    
    const maxId = Math.max(...numericIds);
    return String(maxId + 1);
  } catch (error) {
    console.error('Error getting next employee ID:', error);
    throw error;
  }
}

// Add new employee
export interface AddEmployeeParams {
  username: string;
  name: string;
  isAdmin: boolean;
  password: string;
}

export async function addEmployee(params: AddEmployeeParams): Promise<string> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }

  const trimmedUsername = params.username.trim().toLowerCase();
  
  if (!trimmedUsername || !params.name.trim() || !params.password) {
    throw new Error('Username, name, and password are required.');
  }

  // Check if username already exists
  const existingQ = query(
    collection(db, EMPLOYEE_COLLECTION),
    where('username', '==', trimmedUsername)
  );
  const existingSnap = await getDocs(existingQ);
  
  if (!existingSnap.empty) {
    throw new Error('Username already exists.');
  }

  // Get next ID
  const nextId = await getNextEmployeeId();

  // Create employee document
  const employeeData = {
    id: nextId,
    username: trimmedUsername,
    name: params.name.trim(),
    isAdmin: Boolean(params.isAdmin),
    password: params.password, // Store password as plain text (as per existing structure)
  };

  const docRef = await addDoc(collection(db, EMPLOYEE_COLLECTION), employeeData);
  console.log(`✅ Added employee: ${params.name} (ID: ${nextId}, Username: ${trimmedUsername})`);
  
  return nextId;
}

// Update employee
export interface UpdateEmployeeParams {
  id: string;
  username?: string;
  name?: string;
  isAdmin?: boolean;
  password?: string;
}

export async function updateEmployee(params: UpdateEmployeeParams): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }

  if (!params.id) {
    throw new Error('Employee ID is required.');
  }

  // Find employee by ID
  const q = query(
    collection(db, EMPLOYEE_COLLECTION),
    where('id', '==', params.id)
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error('Employee not found.');
  }

  const docSnapshot = snap.docs[0];
  const docRef = doc(db, EMPLOYEE_COLLECTION, docSnapshot.id);
  const currentData = docSnapshot.data() as any;

  // Build update data
  const updateData: Record<string, any> = {};

  // If username is being updated, check for duplicates
  if (params.username !== undefined) {
    const trimmedUsername = params.username.trim().toLowerCase();
    if (trimmedUsername !== currentData.username) {
      // Check if new username already exists
      const existingQ = query(
        collection(db, EMPLOYEE_COLLECTION),
        where('username', '==', trimmedUsername)
      );
      const existingSnap = await getDocs(existingQ);
      
      if (!existingSnap.empty && existingSnap.docs[0].id !== docSnapshot.id) {
        throw new Error('Username already exists.');
      }
      updateData.username = trimmedUsername;
    }
  }

  if (params.name !== undefined) {
    updateData.name = params.name.trim();
  }

  if (params.isAdmin !== undefined) {
    updateData.isAdmin = Boolean(params.isAdmin);
  }

  if (params.password !== undefined && params.password.trim() !== '') {
    updateData.password = params.password;
  }

  await updateDoc(docRef, updateData);
  console.log(`✅ Updated employee: ID ${params.id}`);
}

// Get employee by ID
export async function getEmployeeById(employeeId: string): Promise<LaundryEmployee | null> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }

  try {
    const q = query(
      collection(db, EMPLOYEE_COLLECTION),
      where('id', '==', employeeId)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return null;
    }

    const docSnapshot = snap.docs[0];
    const data = docSnapshot.data() as any;
    
    return {
      id: String(data.id ?? docSnapshot.id),
      username: String(data.username ?? ''),
      name: String(data.name ?? ''),
      isAdmin: Boolean(data.isAdmin === true),
    };
  } catch (error) {
    console.error('Error fetching employee by ID:', error);
    throw error;
  }
}

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

// Force Logout functions
const FORCE_LOGOUT_COLLECTION = 'laundry_force_logout';
const FORCE_LOGOUT_DOC_ID = 'current';

export interface ForceLogoutPayload {
  triggered: boolean;
  triggeredAt: string;
  triggeredBy: string;
}

export async function triggerForceLogout(triggeredBy: string = 'Admin'): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  const docRef = doc(db, FORCE_LOGOUT_COLLECTION, FORCE_LOGOUT_DOC_ID);
  const payload: ForceLogoutPayload = {
    triggered: true,
    triggeredAt: new Date().toISOString(),
    triggeredBy: triggeredBy.trim(),
  };
  await setDoc(docRef, payload);
  console.log('✅ Force logout triggered in Firestore');
}

export async function clearForceLogout(): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  const docRef = doc(db, FORCE_LOGOUT_COLLECTION, FORCE_LOGOUT_DOC_ID);
  await deleteDoc(docRef);
  console.log('✅ Force logout cleared from Firestore');
}

export function subscribeToForceLogout(
  onChange: (payload: ForceLogoutPayload | null) => void
): () => void {
  if (!db) {
    console.warn('Firestore is not initialized; force logout subscription disabled.');
    onChange(null);
    return () => {};
  }
  const docRef = doc(db, FORCE_LOGOUT_COLLECTION, FORCE_LOGOUT_DOC_ID);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      const data = snapshot.data() as ForceLogoutPayload;
      onChange(data);
    },
    (error) => {
      console.error('Error subscribing to force logout:', error);
      onChange(null);
    }
  );
}

// Parse OCR text to extract customer information
export interface ParsedOCRData {
  customerName: string;
  totalWeightKg: number;
  extractedText: string;
}

export function parseOCRText(ocrText: string): ParsedOCRData | null {
  try {
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Find customer name - usually on 2nd line, may have dash before it or not
    let customerName = '';
    let weight = 0;
    
    // Look for customer name pattern: "Name - Time" or just "Name"
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      
      // Pattern 1: "Name - Time" (e.g., "Gino - 8:46 AM" or "Mark Pacencia - 3:45 PM")
      // Also handle cases like "& Mami - 11:22 AM "8" with leading symbols and trailing characters
      // Match pattern: name (letters/spaces), then dash, then time (allow trailing characters after AM/PM)
      // Make the regex more flexible to handle trailing characters after AM/PM
      const nameWithDashMatch = line.match(/([A-Z][a-zA-Z\s]*?)\s*-\s*\d+:\d+\s*(?:AM|PM)/i);
      if (nameWithDashMatch) {
        customerName = nameWithDashMatch[1].trim();
        // Clean up any extra characters that might be before the name (like "&", "<", etc.)
        customerName = customerName.replace(/^[^A-Za-z]+/, '').trim();
        // IMPORTANT: Remove any "AM" or "PM" that might be at the end of the name
        // This handles cases where OCR might have put "AM" before the dash
        customerName = customerName.replace(/\s+(AM|PM)\s*$/i, '').trim();
        // Remove any trailing numbers, special characters, quotes, or any non-letter characters
        customerName = customerName.replace(/[\d\W"']+$/, '').trim();
        // Remove any leading/trailing quotes
        customerName = customerName.replace(/^["']+|["']+$/g, '').trim();
        // Final cleanup: remove any standalone "AM" or "PM" words anywhere in the name
        customerName = customerName.replace(/\b(AM|PM)\b/gi, '').trim();
        // Clean up any double spaces
        customerName = customerName.replace(/\s+/g, ' ').trim();
        if (customerName.length > 0) {
          console.log(`✅ Extracted customer name: "${customerName}" from line: "${line}"`);
          break;
        }
      }
      
      // Pattern 1a: Try a more lenient match that allows any characters before the name
      // This handles cases where the line starts with symbols like "& Mami - 11:22 AM"
      if (!customerName) {
        const lenientMatch = line.match(/[^A-Z]*([A-Z][a-zA-Z\s]{2,30}?)\s*-\s*\d+:\d+\s*(?:AM|PM)/i);
        if (lenientMatch) {
          customerName = lenientMatch[1].trim();
          customerName = customerName.replace(/^[^A-Za-z]+/, '').trim();
          customerName = customerName.replace(/\s+(AM|PM)\s*$/i, '').trim();
          customerName = customerName.replace(/[\d\W"']+$/, '').trim();
          customerName = customerName.replace(/^["']+|["']+$/g, '').trim();
          customerName = customerName.replace(/\b(AM|PM)\b/gi, '').trim();
          customerName = customerName.replace(/\s+/g, ' ').trim();
          if (customerName.length > 0) {
            console.log(`✅ Extracted customer name (lenient): "${customerName}" from line: "${line}"`);
            break;
          }
        }
      }
      
      // Pattern 1b: Handle case where "AM"/"PM" might appear before the dash
      // e.g., "Gino AM - 8:46" (though this shouldn't happen in normal cases)
      const nameWithAMBeforeDash = line.match(/([A-Z][a-zA-Z\s]+?)\s+(AM|PM)\s*-\s*\d+:\d+/i);
      if (nameWithAMBeforeDash && !customerName) {
        customerName = nameWithAMBeforeDash[1].trim();
        customerName = customerName.replace(/^[^A-Za-z]+/, '').trim();
        customerName = customerName.replace(/\s+/g, ' ').trim();
        if (customerName.length > 0) {
          break;
        }
      }
      
      // Pattern 2: Just name without dash (e.g., "Shy Aragones")
      // Look for lines that look like names (capital letter, letters/spaces, not too long, no numbers/symbols)
      if (i > 0 && i < 5) {
        // Remove common OCR artifacts and check if it's a valid name
        const cleanedLine = line.replace(/[^A-Za-z\s]/g, '').trim();
        // Remove AM/PM if present
        const cleanedLineNoTime = cleanedLine.replace(/\s+(AM|PM)$/i, '').trim();
        if (cleanedLineNoTime.length >= 3 && cleanedLineNoTime.length <= 50 && /^[A-Z][a-zA-Z\s]+$/.test(cleanedLineNoTime)) {
          // Make sure it doesn't contain common non-name words
          const lowerLine = cleanedLineNoTime.toLowerCase();
          if (!lowerLine.includes('regular') && !lowerLine.includes('laundry') && 
              !lowerLine.includes('comforter') && !lowerLine.includes('total') &&
              !lowerLine.includes('charge') && !lowerLine.includes('save') &&
              !lowerLine.includes('downy') && !lowerLine.includes('blue')) {
            customerName = cleanedLineNoTime.trim();
            break;
          }
        }
      }
    }
    
    // Find weight - look for "Regular Laundry" or "Comforter Laundry" followed by "x" and number
    // Handle OCR typos like "Regufar" instead of "Regular"
    for (const line of lines) {
      // Pattern: "Regular Laundry" or "Regufar Laundry" (OCR typo) or "Comforter Laundry"
      // Followed by "x" and number like "x 18.800" or "x 17.300"
      // Match variations: "Regular", "Regufar", "Regufar", "Comforter", etc.
      const weightMatch = line.match(/(?:Reg(?:ular|ufar)|Comforter)\s+Laundry[^x]*x\s*([\d.]+)/i);
      if (weightMatch) {
        weight = parseFloat(weightMatch[1]);
        if (weight > 0) {
          break;
        }
      }
    }
    
    if (!customerName || weight === 0) {
      console.warn('Could not parse customer name or weight from OCR text');
      console.warn('Lines:', lines);
      return null;
    }
    
    return {
      customerName: customerName.trim(),
      totalWeightKg: weight,
      extractedText: ocrText,
    };
  } catch (error) {
    console.error('Error parsing OCR text:', error);
    return null;
  }
}

// Add customer record from OCR to Firestore
export async function addCustomerRecordFromOCR(
  parsedData: ParsedOCRData,
  senderName: string
): Promise<string> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    // Format date as "2025-11-16 09:24 AM"
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    const hours = now.getHours();
    const minutes = `${now.getMinutes()}`.padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const dateString = `${year}-${month}-${day} ${displayHours}:${minutes} ${ampm}`;
    
    const recordData = {
      customer_name: parsedData.customerName,
      total_kg: parsedData.totalWeightKg,
      date: dateString,
      status: 1, // In Progress
      timestamp: Timestamp.now(),
      total_cost: 30, // Default as specified
      extracted_text: parsedData.extractedText,
      sender_name: senderName,
    };
    
    const docRef = await addDoc(collection(db, 'laundry_records'), recordData);
    console.log(`✅ Added customer record from OCR: ${parsedData.customerName} (${parsedData.totalWeightKg}kg) - ID: ${docRef.id}`);
    
    return docRef.id;
  } catch (error) {
    console.error('❌ Error adding customer record from OCR:', error);
    throw error;
  }
}

// Sync control (enable/disable sync button on Admin page)
const SYNC_CONTROL_COLLECTION = 'laundry_sync_control';
const SYNC_CONTROL_DOC_ID = 'current';

export interface SyncControlPayload {
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export async function setSyncControl(
  enabled: boolean,
  updatedBy: string = 'Admin'
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  const docRef = doc(db, SYNC_CONTROL_COLLECTION, SYNC_CONTROL_DOC_ID);
  const payload: SyncControlPayload = {
    enabled,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy.trim(),
  };
  await setDoc(docRef, payload);
  console.log(`✅ Sync control updated in Firestore (enabled=${enabled})`);
}

export function subscribeToSyncControl(
  onChange: (payload: SyncControlPayload | null) => void
): () => void {
  if (!db) {
    console.warn('Firestore is not initialized; sync control subscription disabled.');
    onChange(null);
    return () => {};
  }
  const docRef = doc(db, SYNC_CONTROL_COLLECTION, SYNC_CONTROL_DOC_ID);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        console.log('📋 Sync control: no document exists, defaulting to enabled');
        onChange(null);
        return;
      }
      const data = snapshot.data() as SyncControlPayload;
      console.log('📋 Sync control document:', data);
      onChange({
        enabled: data.enabled ?? true, // Default to enabled if not specified
        updatedAt: data.updatedAt || new Date().toISOString(),
        updatedBy: data.updatedBy || 'Admin',
      });
    },
    (error) => {
      console.error('Error subscribing to sync control:', error);
      onChange(null);
    }
  );
}

