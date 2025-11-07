import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get access token from environment variable (server-side only)
  // Check both VITE_LOYVERSE_ACCESS_TOKEN and LOYVERSE_ACCESS_TOKEN for flexibility
  const apiToken = process.env.VITE_LOYVERSE_ACCESS_TOKEN || process.env.LOYVERSE_ACCESS_TOKEN;

  if (!apiToken) {
    return res.status(500).json({ 
      error: 'Loyverse access token not configured. Please set VITE_LOYVERSE_ACCESS_TOKEN or LOYVERSE_ACCESS_TOKEN in Vercel environment variables.' 
    });
  }

  try {
    // Get customer ID from URL parameter
    const { customerId } = req.query;

    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'customerId is required' });
    }

    // Build Loyverse API URL
    const url = `https://api.loyverse.com/v1.0/customers/${customerId}`;

    // Make request to Loyverse API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    
    // Return the data with CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying Loyverse customer request:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch customer from Loyverse',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

