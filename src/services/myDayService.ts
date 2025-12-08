import { 
  collection, 
  doc, 
  setDoc,
  getDoc,
  Timestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { db, storage } from './firebaseConfig';

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

// Upload image to Firebase Storage
export async function uploadImageToStorage(date: string, file: File): Promise<string> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `my-day-images/${date}/${fileName}`);
    
    console.log(`📤 Uploading image: ${fileName} for date ${date}...`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    console.log(`✅ Image uploaded successfully: ${downloadURL}`);
    
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    throw error;
  }
}

// Get all images for a specific date
export async function getImagesForDate(date: string): Promise<string[]> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    const folderRef = ref(storage, `my-day-images/${date}`);
    const result = await listAll(folderRef);
    
    const urls = await Promise.all(
      result.items.map(async (itemRef) => {
        return await getDownloadURL(itemRef);
      })
    );
    
    console.log(`✅ Fetched ${urls.length} images for ${date}`);
    return urls;
  } catch (error) {
    // If folder doesn't exist, return empty array
    if ((error as any).code === 'storage/object-not-found') {
      return [];
    }
    console.error('❌ Error fetching images:', error);
    throw error;
  }
}

// Delete image from Firebase Storage
export async function deleteImageFromStorage(imageUrl: string): Promise<void> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized. Please configure Firebase environment variables.');
  }
  
  try {
    // Extract the path from the URL
    const urlObj = new URL(imageUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)\?/);
    if (!pathMatch) {
      throw new Error('Invalid image URL');
    }
    
    const decodedPath = decodeURIComponent(pathMatch[1]);
    const imageRef = ref(storage, decodedPath);
    
    console.log(`🗑️ Deleting image: ${decodedPath}...`);
    await deleteObject(imageRef);
    console.log(`✅ Image deleted successfully`);
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    throw error;
  }
}

