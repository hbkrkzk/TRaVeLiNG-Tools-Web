import type { VercelRequest, VercelResponse } from '@vercel/node';

type Short2LongItem = {
  long?: string;
};

type ApiSuccessResponse = {
  short2long?: Short2LongItem[];
};

const extractLongUrl = (body: string): string | null => {
  try {
    const parsed: ApiSuccessResponse = JSON.parse(body);
    const longFromJson = parsed.short2long?.[0]?.long;
    if (typeof longFromJson === 'string' && longFromJson.length > 0) {
      return longFromJson;
    }
  } catch {
    // Some responses are JSON-like, so fall back to regex extraction.
  }

  const regex = /"?long"?\s*:\s*"([^"]+)"/;
  const matched = body.match(regex);
  if (!matched?.[1]) {
    return null;
  }

  return matched[1]
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const shortUrl = req.query.url;

  if (typeof shortUrl !== 'string' || shortUrl.length === 0) {
    res.status(400).json({ error: 'url parameter is required' });
    return;
  }

  try {
    const target = `http://app.tree-web.net/short2longurl/api.cgi?url=${encodeURIComponent(shortUrl)}`;
    const apiResponse = await fetch(target);

    if (!apiResponse.ok) {
      throw new Error(`short2long API failed with status: ${apiResponse.status}`);
    }

    const responseBody = await apiResponse.text();
    const longUrl = extractLongUrl(responseBody);

    if (!longUrl) {
      throw new Error('short2long API response did not include long URL');
    }

    res.status(200).json({ longUrl, source: shortUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to expand short URL' });
  }
}
