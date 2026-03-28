import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const longUrl = req.query.url;
  const apiKey = "7d2ad123799e3bdd05a3553b5d2f7968";

  if (typeof longUrl !== 'string') {
    res.status(400).json({ error: 'URL parameter is required' });
    return;
  }

  try {
    const targetUrl = `https://xgd.io/V1/shorten?url=${encodeURIComponent(longUrl)}&key=${apiKey}`;
    const apiResponse = await fetch(targetUrl);

    if (!apiResponse.ok) {
      throw new Error(`xgd.io API request failed with status: ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to shorten URL' });
  }
}
