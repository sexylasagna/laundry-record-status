import { 
  collection, 
  doc, 
  setDoc,
  getDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebaseConfig';

export interface LineupItem {
  customerId: string;
  customerName: string;
  totalWeightKg: number;
  position: number;
  equipment?: string[]; // Array of equipment tags (e.g., ["Dryer 1", "Dryer 2"])
}

export interface MyDayLineup {
  date: string; // YYYY-MM-DD format
  lineup: LineupItem[]; // Array of items assigned to positions 1-20
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Save lineup to Firestore
export async function saveLineupToFirestore(lineup: MyDayLineup): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    const lineupRef = doc(db, 'laundry_my_day_lineup', lineup.date);
    const data = {
      date: lineup.date,
      lineup: lineup.lineup,
      updatedAt: Timestamp.now(),
    };
    
    // Check if document exists to preserve createdAt
    const existingDoc = await getDoc(lineupRef);
    if (!existingDoc.exists()) {
      (data as any).createdAt = Timestamp.now();
    }
    
    console.log(`📝 Saving lineup for ${lineup.date} with ${lineup.lineup.length} items...`);
    await setDoc(lineupRef, data, { merge: true });
    console.log(`✅ Successfully saved lineup for ${lineup.date}`);
  } catch (error) {
    console.error(`❌ Error saving lineup for ${lineup.date}:`, error);
    throw error;
  }
}

// Fetch lineup from Firestore
export async function fetchLineupFromFirestore(date: string): Promise<MyDayLineup | null> {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    const lineupRef = doc(db, 'laundry_my_day_lineup', date);
    const docSnapshot = await getDoc(lineupRef);
    
    if (!docSnapshot.exists()) {
      console.log(`📄 No lineup found for ${date}`);
      return null;
    }
    
    const data = docSnapshot.data();
    console.log(`✅ Fetched lineup for ${date}:`, data);
    
    return {
      date: data.date || date,
      lineup: data.lineup || [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error(`❌ Error fetching lineup for ${date}:`, error);
    throw error;
  }
}

