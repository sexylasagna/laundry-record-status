import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  orderBy,
  where
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { CustomerRecord, LaundryStatus } from '../types';

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
  
  return {
    id: docId,
    dateDropped: data.date || '', // "2025-11-02 04:47 PM"
    customerName: data.customer_name || '',
    totalWeightKg: Number(data.total_kg) || 0,
    status: (data.status as LaundryStatus) || 1,
    datePaid: datePaid,
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
  datePaid?: string
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    const docRef = doc(db, 'laundry_records', docId);
    const updateData: any = { status };
    
    if (status === 3 && datePaid) {
      updateData.date_paid = datePaid;
      console.log(`📅 Adding date_paid: ${datePaid} to document ${docId}`);
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

