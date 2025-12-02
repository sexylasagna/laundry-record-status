import { CustomerRecord, LaundryStatus } from '../types';
import { fetchCustomersFromFirestore, updateCustomerStatusInFirestore, updateCustomerNameInFirestore, updateTotalWeightInFirestore } from './firestoreService';

// Helper to parse status from string (for backward compatibility with sheets)
function parseStatus(status: string | undefined): LaundryStatus {
  if (status === '1' || status === 'In progress') return 1;
  if (status === '2' || status === 'Ready for Pickup' || status === 'Done') return 2;
  if (status === '3' || status === 'Claimed & Paid') return 3;
  return 1; // default to In progress
}

const STORAGE_KEY = 'kwiksilver:customers';

function mockData(): CustomerRecord[] {
  return [
    {
      id: '1',
      dateDropped: '2025-10-28 09:15 AM',
      customerName: 'John Doe',
      totalWeightKg: 5.2,
      status: 1, // In progress
    },
    {
      id: '2',
      dateDropped: '2025-10-29 02:30 PM',
      customerName: 'Jane Doe',
      datePaid: '2025-10-31',
      totalWeightKg: 3.8,
      status: 3, // Claimed & Paid
    },
    {
      id: '3',
      dateDropped: '2025-10-30 11:45 AM',
      customerName: 'Nikka',
      totalWeightKg: 7.0,
      status: 1, // In progress
    },
    {
      id: '4',
      dateDropped: '2025-10-30 03:20 PM',
      customerName: 'Jungkook',
      totalWeightKg: 12.0,
      status: 1, // In progress
    },
    {
      id: '5',
      dateDropped: '2025-10-30 08:25 PM',
      customerName: 'Taehyung',
      totalWeightKg: 13.0,
      status: 1, // In progress
    },
  ];
}

function parseSheetValues(values: string[][]): CustomerRecord[] {
  // Expect header row: Date Dropped | Customer name | Total Weight | Status
  const rows = values.slice(1);
  return rows
    .filter((r) => r && r.length >= 4)
    .map((r, idx) => {
      const [dateDropped, customerName, totalWeight, status] = r;
      return {
        id: `${idx + 1}`,
        dateDropped,
        customerName,
        totalWeightKg: Number(totalWeight) || 0,
        status: parseStatus(status),
      };
    });
}

export async function fetchCustomers(): Promise<CustomerRecord[]> {
  // Try Firestore first if configured
  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true' || 
                       import.meta.env.VITE_FIREBASE_PROJECT_ID;
  
  const hasApiKey = !!import.meta.env.VITE_FIREBASE_API_KEY;
  
  if (useFirestore) {
    if (!hasApiKey) {
      console.warn('⚠️ Firebase Project ID found but VITE_FIREBASE_API_KEY is missing.');
      console.warn('📝 Get your Firebase Web App config from: https://console.firebase.google.com/project/laundry-record-status/settings/general');
      console.warn('📝 Falling back to mock data until Firebase is configured.');
    } else {
      try {
        console.log('🔄 Fetching data from Firestore...');
        const records = await fetchCustomersFromFirestore();
        // Cache in localStorage for offline support
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        console.log(`✅ Loaded ${records.length} records from Firestore`);
        return records;
      } catch (error) {
        console.error('❌ Firestore fetch failed:', error);
        // Fallback to cached data if available
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            console.log('📦 Using cached data...');
            return JSON.parse(stored) as CustomerRecord[];
          } catch {}
        }
        // Final fallback to mock data
        console.log('📝 Using mock data as fallback');
        return mockData();
      }
    }
  }

  // Legacy: Check localStorage cache
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as CustomerRecord[];
    } catch {}
  }

  // Legacy: Google Sheets integration
  const sheetId = import.meta.env.VITE_SHEET_ID as string | undefined;
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY as string | undefined;
  const range = import.meta.env.VITE_SHEET_RANGE || 'Sheet1!A:D';

  if (sheetId && apiKey) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
        range as string
      )}?key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Sheets API error');
      const json = (await res.json()) as { values?: string[][] };
      const records = json.values ? parseSheetValues(json.values) : mockData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return records;
    } catch (err) {
      const data = mockData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }
  }

  // Final fallback: mock data
  const data = mockData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

export async function updateCustomerStatus(
  id: string,
  status: LaundryStatus,
  datePaid?: string,
  dateDone?: string,
  datePaidTime?: string,
  dateDoneTime?: string,
  doneBy?: string,
  paidBy?: string
): Promise<CustomerRecord[]> {
  // Try Firestore first if configured
  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true' || 
                       import.meta.env.VITE_FIREBASE_PROJECT_ID;
  
  if (useFirestore) {
    try {
      console.log(`🔄 Updating Firestore document ${id} with status ${status}...`);
      await updateCustomerStatusInFirestore(id, status, datePaid, dateDone, datePaidTime, dateDoneTime, doneBy, paidBy);
      console.log(`✅ Successfully updated Firestore document ${id}`);
      // Refresh data from Firestore after update
      const records = await fetchCustomersFromFirestore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      console.log(`📊 Refreshed ${records.length} records from Firestore`);
      return records;
    } catch (error) {
      console.error('❌ Firestore update failed:', error);
      console.warn('⚠️ Falling back to localStorage update');
      // Fall through to localStorage update as backup
    }
  }

  // Update localStorage cache
  const existing = (JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as CustomerRecord[]).map(
    (r) => {
      if (r.id === id) {
        const update: Partial<CustomerRecord> = { status };
        if (status === 3) { // Claimed & Paid
          if (datePaid) {
            update.datePaid = datePaid;
          }
          if (datePaidTime) {
            update.datePaidTime = datePaidTime;
          }
          if (dateDone) {
            update.dateDone = dateDone;
          }
          if (dateDoneTime) {
            update.dateDoneTime = dateDoneTime;
          }
          if (paidBy) {
            update.paidBy = paidBy;
          }
        } else if (status === 2) {
          if (dateDone) {
            update.dateDone = dateDone;
          }
          if (dateDoneTime) {
            update.dateDoneTime = dateDoneTime;
          }
          if (doneBy) {
            update.doneBy = doneBy;
          }
        }
        return { ...r, ...update };
      }
      return r;
    }
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

  // Legacy: Optional backend endpoint
  const writeEndpoint = import.meta.env.VITE_SHEETS_WRITE_ENDPOINT as string | undefined;
  if (writeEndpoint) {
    try {
      await fetch(writeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, datePaid, dateDone, datePaidTime, dateDoneTime }),
      });
    } catch {
      // Ignore write errors; local persistence still applied
    }
  }

  return existing;
}

export async function updateCustomerName(
  id: string,
  customerName: string
): Promise<CustomerRecord[]> {
  // Try Firestore first if configured
  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true' || 
                       import.meta.env.VITE_FIREBASE_PROJECT_ID;
  
  if (useFirestore) {
    try {
      console.log(`🔄 Updating customer name for document ${id}...`);
      await updateCustomerNameInFirestore(id, customerName);
      console.log(`✅ Successfully updated customer name for document ${id}`);
      // Refresh data from Firestore after update
      const records = await fetchCustomersFromFirestore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      console.log(`📊 Refreshed ${records.length} records from Firestore`);
      return records;
    } catch (error) {
      console.error('❌ Firestore update failed:', error);
      console.warn('⚠️ Falling back to localStorage update');
      // Fall through to localStorage update as backup
    }
  }

  // Update localStorage cache
  const existing = (JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as CustomerRecord[]).map(
    (r) => {
      if (r.id === id) {
        return { ...r, customerName };
      }
      return r;
    }
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

  // Legacy: Optional backend endpoint
  const writeEndpoint = import.meta.env.VITE_SHEETS_WRITE_ENDPOINT as string | undefined;
  if (writeEndpoint) {
    try {
      await fetch(writeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, customerName }),
      });
    } catch {
      // Ignore write errors; local persistence still applied
    }
  }

  return existing;
}

export async function updateTotalWeight(
  id: string,
  totalWeightKg: number
): Promise<CustomerRecord[]> {
  // Try Firestore first if configured
  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true' || 
                       import.meta.env.VITE_FIREBASE_PROJECT_ID;
  
  if (useFirestore) {
    try {
      console.log(`🔄 Updating total weight for document ${id}...`);
      await updateTotalWeightInFirestore(id, totalWeightKg);
      console.log(`✅ Successfully updated total weight for document ${id}`);
      // Refresh data from Firestore after update
      const records = await fetchCustomersFromFirestore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      console.log(`📊 Refreshed ${records.length} records from Firestore`);
      return records;
    } catch (error) {
      console.error('❌ Firestore update failed:', error);
      console.warn('⚠️ Falling back to localStorage update');
      // Fall through to localStorage update as backup
    }
  }

  // Update localStorage cache
  const existing = (JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as CustomerRecord[]).map(
    (r) => {
      if (r.id === id) {
        return { ...r, totalWeightKg };
      }
      return r;
    }
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

  // Legacy: Optional backend endpoint
  const writeEndpoint = import.meta.env.VITE_SHEETS_WRITE_ENDPOINT as string | undefined;
  if (writeEndpoint) {
    try {
      await fetch(writeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, totalWeightKg }),
      });
    } catch {
      // Ignore write errors; local persistence still applied
    }
  }

  return existing;
}


