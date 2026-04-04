import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const deepLink = req.query.deepLink;

  if (typeof deepLink !== 'string' || deepLink.length === 0) {
    res.status(400).json({ error: 'deepLink parameter is required' });
    return;
  }

  const partnerId = process.env.IMPACT_PARTNER_ID;
  const apiKey = process.env.IMPACT_API_KEY;
  const programId = process.env.IMPACT_PROGRAM_ID || '13416';

  if (!partnerId || !apiKey) {
    console.error('Missing required environment variables: IMPACT_PARTNER_ID or IMPACT_API_KEY');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    // Create Basic Auth credentials
    const credentials = Buffer.from(`${partnerId}:${apiKey}`).toString('base64');

    const endpoint = `https://api.impact.com/Mediapartners/${partnerId}/Programs/${programId}/TrackingLinks`;
    const body = new URLSearchParams({
      DeepLink: deepLink,
      Type: 'vanity',
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Impact.com API error: ${response.status} - ${errorText}`);
      throw new Error(`Impact.com API request failed with status: ${response.status}`);
    }

    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (error) {
    console.error('Affiliate link generation failed:', error);
    res.status(500).json({ error: 'Failed to generate affiliate link' });
  }
}
