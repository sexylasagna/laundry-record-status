// Loyverse API Service
// Documentation: https://developer.loyverse.com/docs

interface LoyverseReceipt {
  id: string;
  receipt_date: string; // ISO date string
  customer_id?: string;
  total: number;
  // ... other receipt fields
}

interface LoyverseCustomer {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  // ... other customer fields
}

interface ReceiptWithCustomer {
  receiptDate: string; // YYYY-MM-DD format
  customerName: string;
}

// Fetch recent receipts from Loyverse
export async function fetchRecentReceipts(days: number = 2): Promise<LoyverseReceipt[]> {
  const apiToken = import.meta.env.VITE_LOYVERSE_ACCESS_TOKEN as string | undefined;
  
  if (!apiToken) {
    throw new Error('Loyverse access token not configured. Please set VITE_LOYVERSE_ACCESS_TOKEN in .env');
  }

  // Calculate date range (last N days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  try {
    // Use proxy in development to avoid CORS, direct API in production
    const useProxy = import.meta.env.DEV;
    const baseUrl = useProxy 
      ? '/api/loyverse/receipts'
      : 'https://api.loyverse.com/v1.0/receipts';
    
    const url = `${baseUrl}?receipt_date_min=${startDateStr}&receipt_date_max=${endDateStr}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`, // Always include, proxy will forward it
    };
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Loyverse API error response:', errorData);
      throw new Error(
        `Loyverse API error: ${response.status} ${response.statusText}. ` +
        (errorData.errors ? JSON.stringify(errorData.errors) : '')
      );
    }

    const data = await response.json();
    return data.receipts || [];
  } catch (error) {
    console.error('Error fetching receipts from Loyverse:', error);
    throw error;
  }
}

// Get customer details by customer_id
export async function getCustomerById(customerId: string): Promise<LoyverseCustomer | null> {
  const apiToken = import.meta.env.VITE_LOYVERSE_ACCESS_TOKEN as string | undefined;
  
  if (!apiToken) {
    throw new Error('Loyverse access token not configured');
  }

  try {
    // Use proxy in development to avoid CORS, direct API in production
    const useProxy = import.meta.env.DEV;
    const baseUrl = useProxy
      ? `/api/loyverse/customers/${customerId}`
      : `https://api.loyverse.com/v1.0/customers/${customerId}`;
    
    const url = baseUrl;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`, // Always include, proxy will forward it
    };
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Customer not found
      }
      const errorData = await response.json().catch(() => ({}));
      console.error('Loyverse API error response:', errorData);
      throw new Error(
        `Loyverse API error: ${response.status} ${response.statusText}. ` +
        (errorData.errors ? JSON.stringify(errorData.errors) : '')
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching customer ${customerId} from Loyverse:`, error);
    return null;
  }
}

// Get customer name from customer object
function getCustomerName(customer: LoyverseCustomer): string {
  if (customer.name) {
    return customer.name.trim();
  }
  if (customer.first_name || customer.last_name) {
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  }
  return '';
}

// Fetch receipts with customer names
export async function fetchReceiptsWithCustomers(days: number = 2): Promise<ReceiptWithCustomer[]> {
  const receipts = await fetchRecentReceipts(days);
  const receiptsWithCustomers: ReceiptWithCustomer[] = [];

  for (const receipt of receipts) {
    if (!receipt.customer_id) {
      continue; // Skip receipts without customer_id
    }

    const customer = await getCustomerById(receipt.customer_id);
    if (!customer) {
      continue; // Skip if customer not found
    }

    const customerName = getCustomerName(customer);
    if (!customerName) {
      continue; // Skip if no customer name
    }

    // Extract date from receipt_date (format: "2025-11-02T16:47:32+08:00" or "2025-11-02")
    const receiptDate = receipt.receipt_date.split('T')[0]; // Get YYYY-MM-DD

    receiptsWithCustomers.push({
      receiptDate,
      customerName,
    });
  }

  return receiptsWithCustomers;
}

