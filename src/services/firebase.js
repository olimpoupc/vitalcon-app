import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  deleteDoc 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAbNQhH5tjEIiQpbLciLXSl98saFkjSJr0",
  authDomain: "vitalcon-8e433.firebaseapp.com",
  projectId: "vitalcon-8e433",
  storageBucket: "vitalcon-8e433.firebasestorage.app",
  messagingSenderId: "1086547809623",
  appId: "1:1086547809623:web:a909e0e5884ff189129a12"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const INVOICES_COLLECTION = 'facturas_vitalcon';

/**
 * Generate a clean, readable ID for an invoice (e.g. CR-33303 or VTC-20261105-XXXX)
 */
export function generateInvoiceId(title = '') {
  // Try to find invoice number like CR 33303, CR-33303, etc.
  const match = title.match(/CR[\s-_]?(\d+)/i);
  if (match) {
    return `CR-${match[1]}`;
  }
  // Otherwise clean string or short code
  const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return cleanTitle ? `${cleanTitle}-${dateStr}-${randomSuffix}` : `VTC-${dateStr}-${randomSuffix}`;
}

/**
 * Saves or updates an invoice in Cloud Firestore
 */
export async function saveInvoiceToCloud({ id, title, rawItems, marginPercent, totals }) {
  try {
    const invoiceId = id || generateInvoiceId(title);
    const invoiceRef = doc(db, INVOICES_COLLECTION, invoiceId);

    const invoiceData = {
      id: invoiceId,
      title: title || 'Factura Vitalcon',
      marginPercent: marginPercent || 25,
      itemsCount: rawItems.length,
      totalCost: totals.totalCost || 0,
      totalProjectedSale: totals.totalProjectedSale || 0,
      totalProfit: totals.totalProfit || 0,
      // Store the raw items so they can be re-calculated with any margin dynamically
      rawItems: rawItems,
      createdAt: serverTimestamp(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(invoiceRef, invoiceData, { merge: true });
    return { success: true, id: invoiceId, data: invoiceData };
  } catch (error) {
    console.error('Error saving invoice to Firebase Firestore:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Loads a single invoice by its ID
 */
export async function getInvoiceFromCloud(invoiceId) {
  try {
    if (!invoiceId) return null;
    const cleanId = invoiceId.trim();
    const invoiceRef = doc(db, INVOICES_COLLECTION, cleanId);
    const docSnap = await getDoc(invoiceRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching invoice from Firestore:', error);
    return null;
  }
}

/**
 * Fetches recent invoices for the History drawer/modal
 */
export async function getRecentInvoicesFromCloud(limitCount = 25) {
  try {
    const q = query(
      collection(db, INVOICES_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    const list = [];
    querySnapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    return list;
  } catch (error) {
    console.error('Error fetching recent invoices from Firestore:', error);
    return [];
  }
}

/**
 * Deletes an invoice from Cloud Firestore
 */
export async function deleteInvoiceFromCloud(invoiceId) {
  try {
    const invoiceRef = doc(db, INVOICES_COLLECTION, invoiceId);
    await deleteDoc(invoiceRef);
    return true;
  } catch (error) {
    console.error('Error deleting invoice from Firestore:', error);
    return false;
  }
}
