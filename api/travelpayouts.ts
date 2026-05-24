import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Access-Token');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url, campaignId } = req.query;

  if (typeof url !== 'string' || !url) {
    res.status(400).json({ error: 'url parameter is required' });
    return;
  }

  // Use environment variable or fallback to the one found in iOS
  const apiKey = process.env.TRAVELPAYOUTS_API_KEY || 'b5eab9b181d11b677083dee207b74206';
  const trs = 532203;
  const marker = 731698;

  try {
    const endpoint = 'https://api.travelpayouts.com/links/v1/create';
    
    const body = {
      trs: trs,
      marker: marker,
      shorten: false,
      links: [
        {
          url: url,
          sub_id: null
        }
      ]
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Token': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TravelPayouts API error: ${response.status} - ${errorText}`);
      throw new Error(`TravelPayouts API request failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    // The response structure from TravelPayouts is:
    // { result: { links: [ { partner_url: "..." } ] }, ... }
    if (data.result && data.result.links && data.result.links[0] && data.result.links[0].partner_url) {
      res.status(200).json({ partner_url: data.result.links[0].partner_url });
    } else {
      throw new Error('TravelPayouts API response did not contain partner_url');
    }
  } catch (error) {
    console.error('TravelPayouts link generation failed:', error);
    res.status(500).json({ error: 'Failed to generate partner link' });
  }
}
