import React, { useEffect, useState } from 'react';
import { Link, Copy, Share2, AlertCircle, Loader, ClipboardPaste, CheckCircle, X, Trash2, Clock3, Search, Plane } from 'lucide-react';

export interface HistoryRecord {
  id: string;
  createdAt: number;
  routeLabel: string;
  dateLabel: string;
  tripLabel: string;
  sourceUrl: string;
  affiliateUrl: string;
  shortUrl: string;
  tripUrl?: string;
  travelokaUrl?: string;
  kiwiUrl?: string;
  shareText: string;
}

const HISTORY_STORAGE_KEY = 'skyscanner_affiliate_history_v1';

const loadHistoryRecords = (): HistoryRecord[] => {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as HistoryRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('履歴ロード失敗:', e);
    return [];
  }
};

const saveHistoryRecords = (records: HistoryRecord[]) => {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records));
};

const addHistoryRecord = (record: HistoryRecord) => {
  const next = [record, ...loadHistoryRecords()].slice(0, 100);
  saveHistoryRecords(next);
};

interface ResultBoxProps {
  title: string;
  icon: React.ReactNode;
  content: string;
  onCopy: () => void;
  copyStatus: 'idle' | 'copied';
  colorClass: string;
}

const ResultBox: React.FC<ResultBoxProps> = ({ title, icon, content, onCopy, copyStatus, colorClass }) => (
  <div className={`result-box ${colorClass}`}>
    <div className="result-header">
      {icon}
      <h3>{title}</h3>
    </div>
    <p className="result-content">{content}</p>
    <button onClick={onCopy} className="button copy-button-alt">
      {copyStatus === 'copied' ? <CheckCircle size={16} /> : <Copy size={16} />}
      {copyStatus === 'copied' ? 'コピー完了' : 'コピー'}
    </button>
  </div>
);


type SkyscannerToolProps = {
  onOpenHistory?: () => void;
};

const SkyscannerTool: React.FC<SkyscannerToolProps> = ({ onOpenHistory }) => {
  const [inputUrl, setInputUrl] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [tripUrl, setTripUrl] = useState('');
  const [travelokaUrl, setTravelokaUrl] = useState('');
  const [kiwiUrl, setKiwiUrl] = useState('');
  const [agodaUrl, setAgodaUrl] = useState('');
  const [tripComEnabled, setTripComEnabled] = useState(false);
  const [travelokaEnabled, setTravelokaEnabled] = useState(false);
  const [kiwiComEnabled, setKiwiComEnabled] = useState(false);
  const [agodaEnabled, setAgodaEnabled] = useState(false);
  const [shareText, setShareText] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [affiliateCopyStatus, setAffiliateCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [shortUrlCopyStatus, setShortUrlCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [tripCopyStatus, setTripCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [travelokaCopyStatus, setTravelokaCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [kiwiCopyStatus, setKiwiCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [shouldAutoConvert, setShouldAutoConvert] = useState(false);

  const normalizeInputUrl = (raw: string): string | null => {
    const cleaned = raw.replace(/\u3000/g, ' ').trim();
    if (!cleaned) {
      return null;
    }

    const httpMatch = cleaned.match(/https?:\/\/[^\s"'<>]+/i);
    if (httpMatch?.[0]) {
      return httpMatch[0].trim();
    }

    const appLinkMatch = cleaned.match(/(?:www\.)?skyscanner\.app\.link\/[^\s"'<>]+/i);
    if (appLinkMatch?.[0]) {
      return `https://${appLinkMatch[0].replace(/^https?:\/\//i, '')}`;
    }

    return cleaned;
  };

  const expandShortUrl = async (url: string): Promise<string> => {
    const localEndpoint = `/api/expand?url=${encodeURIComponent(url)}`;
    try {
      const localResponse = await fetch(localEndpoint, { method: 'GET' });
      if (localResponse.ok) {
        const localData: { longUrl?: string } = await localResponse.json();
        if (localData.longUrl) {
          return localData.longUrl;
        }
      }
    } catch (_localError) {
      // Fall through to public CORS proxy for static-hosted builds.
    }

    const unshortenEndpoint = `https://unshorten.me/json/${encodeURIComponent(url)}`;
    const proxyResponse = await fetch(unshortenEndpoint, { method: 'GET' });

    if (!proxyResponse.ok) {
      const body = await proxyResponse.text();
      throw new Error(`短縮URL展開APIの呼び出しに失敗しました: ${proxyResponse.status} ${body}`);
    }

    const data: { success?: boolean; resolved_url?: string } = await proxyResponse.json();
    if (!data.success || !data.resolved_url) {
      throw new Error('短縮URL展開APIのレスポンスが不正です。');
    }

    return data.resolved_url;
  };

  const parseSkyscannerUrl = (url: string): {
    departure: string;
    arrival: string;
    departDate: string;
    returnDate?: string;
  } | null => {
    try {
      let urlObject = new URL(url);

      // Some app.link URLs resolve to captcha pages that embed the real path in base64 query param.
      if (urlObject.pathname.includes('/sttc/px/captcha-v2/')) {
        const encodedPath = urlObject.searchParams.get('url');
        if (encodedPath) {
          try {
            const normalizedBase64 = encodedPath.replace(/-/g, '+').replace(/_/g, '/');
            const decodedPath = atob(normalizedBase64);
            if (decodedPath.startsWith('/transport/flights/')) {
              urlObject = new URL(`https://www.skyscanner.jp${decodedPath}`);
            }
          } catch (decodeError) {
            console.error('Failed to decode captcha url param:', decodeError);
          }
        }
      }

      const pathParts = urlObject.pathname.split('/').filter(p => p);

      if (pathParts.length < 4 || pathParts[0] !== 'transport' || pathParts[1] !== 'flights') {
        return null;
      }

      const departure = pathParts[2];
      const arrival = pathParts[3];
      let departDate = pathParts[4];
      
      // Convert YYYYMMDD to YYMMDD if needed
      if (departDate.length === 8) {
        departDate = departDate.substring(2);
      }

      if (pathParts.length > 5 && pathParts[5] !== 'config') {
        let returnDate = pathParts[5];
        if (returnDate.length === 8) {
            returnDate = returnDate.substring(2);
        }
        return { departure, arrival, departDate, returnDate };
      }

      return { departure, arrival, departDate };
    } catch (e) {
      console.error("URL parsing failed:", e);
      return null;
    }
  };

  const generateAffiliateUrlViaApi = async (deepLink: string, programId?: string): Promise<string> => {
    try {
      // Use environment variable VITE_API_BASE_URL if set, otherwise use relative path
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      let endpoint = `${apiBase}/api/affiliate?deepLink=${encodeURIComponent(deepLink)}`;
      if (programId) {
        endpoint += `&programId=${programId}`;
      }
      const response = await fetch(endpoint, { method: 'GET' });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Affiliate API request failed with status: ${response.status}. Body: ${errorText}`);
      }

      const data = await response.json() as { TrackingURL?: string };
      if (typeof data.TrackingURL === 'string' && data.TrackingURL.length > 0) {
        // Ensure it has https:// prefix if not already
        return data.TrackingURL.startsWith('http') ? data.TrackingURL : `https://${data.TrackingURL}`;
      }

      throw new Error('Affiliate API response did not contain TrackingURL');
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const shortenUrl = async (longUrl: string): Promise<string> => {
    try {
      const apiKey = "7d2ad123799e3bdd05a3553b5d2f7968";
      const endpoint = `https://xgd.io/V1/shorten?url=${encodeURIComponent(longUrl)}&key=${apiKey}`;
      const response = await fetch(endpoint, { method: 'GET' });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`URL shortener request failed with status: ${response.status}. Body: ${errorText}`);
      }

      const data = await response.json();
      const shortened = data.shorturl ?? data.shortUrl;
      if (typeof shortened === 'string' && shortened.length > 0) {
        return shortened;
      }

      throw new Error('URL shortener response did not contain shorturl');
    } catch (e) {
      console.error(e);
      return longUrl;
    }
  };

  const generateShareText = (url: string, params: {
    departure: string;
    arrival: string;
    departDate: string;
    returnDate?: string;
  }, tripShortUrl?: string, travelokaShortUrl?: string, kiwiShortUrl?: string, agodaShortUrl?: string) => {
    const { returnDate } = params;
    
    let text = "";
        
    // パートナーリンクを追加
    if (kiwiShortUrl) {
        text += `✈️kiwiで予約\n${kiwiShortUrl}\n\n`;
    }

    if (tripShortUrl) {
        text += `✈️Tripで予約\n${tripShortUrl}\n\n`;
    }
    
    if (travelokaShortUrl) {
        text += `✈️トラベロカで予約\n${travelokaShortUrl}\n\n`;
    }

    if (agodaShortUrl) {
        text += `✈️agodaで予約\n${agodaShortUrl}\n\n`;
    }
    
    // Skyscanner
    const tripTypeLabel = returnDate ? "往復" : "片道";
    text += `🔍️スカイスキャナーで検索\n${tripTypeLabel}: ${url}\n\n`;
    
    // パートナー選択がない場合のみ楽天モバイルを表示
    if (!tripShortUrl && !travelokaShortUrl && !kiwiShortUrl && !agodaShortUrl) {
        text += `📲楽天モバイル
🌏海外データ2GB/月
▽乗換で1.4万、新規で1.1万ptゲット
https://x.gd/6LqKk\n\n`;
    }

    text += `💳️セゾンプラチナビジネス
✅PP無料付帯
▽特別招待ー初年度無料＆アマギフ1.2万
https://x.gd/TYSba`;

    return text;
  };

  const formatDateForTrip = (dateStr: string) => {
    // Input: YYMMDD, Output: yyyy-mm-dd
    if (dateStr.length === 6) {
      return `20${dateStr.substring(0,2)}-${dateStr.substring(2,4)}-${dateStr.substring(4,6)}`;
    }
    return dateStr;
  };

  const formatDateForTraveloka = (dateStr: string) => {
    // Input: YYMMDD, Output: dd-m-yyyy (月は先頭ゼロなし)
    if (dateStr.length === 6) {
      const year = `20${dateStr.substring(0,2)}`;
      const month = dateStr.substring(2,4);
      const day = dateStr.substring(4,6);
      const monthInt = parseInt(month, 10);
      return `${day}-${monthInt}-${year}`;
    }
    return dateStr;
  };

  const generateTripURL = (departure: string, arrival: string, departDate: string, returnDate?: string) => {
    const baseURL = "https://jp.trip.com/flights/showfarefirst";
    
    // 都市コードの補正
    const formatCity = (code: string) => {
        const c = code.toUpperCase();
        if (c === 'CSHA') return 'sha'; // CSHAはSHAに変換
        return c.substring(0, 3).toLowerCase(); // 常に3レターに変換
    };

    const dcity = formatCity(departure);
    const acity = formatCity(arrival);
    
    const rdateValue = returnDate ? formatDateForTrip(returnDate) : formatDateForTrip(departDate);
    const triptype = returnDate ? "rt" : "ow";
    
    return `${baseURL}?dcity=${dcity}&acity=${acity}&ddate=${formatDateForTrip(departDate)}&rdate=${rdateValue}&triptype=${triptype}&class=y&lowpricesource=searchform&quantity=1&searchboxarg=t&nonstoponly=off&locale=ja-JP&curr=JPY`;
  };

  const generateTravelokaURL = (departure: string, arrival: string, departDate: string, returnDate?: string) => {
    const baseURL = "https://www.traveloka.com/ja-jp/flight";
    const endpoint = returnDate ? "fulltwosearch" : "fullsearch";
    
    // 都市コードの補正
    const formatCity = (code: string) => {
        const c = code.toUpperCase();
        
        // 特殊変換マップ
        const specialMap: Record<string, string> = {
            'TPET': 'TAIA',
            'BJSA': 'BEIA',
            'TYOA': 'TYOA',
            'CSHA': 'SHAA',
            'BKKT': 'BKKA',
            'NYCA': 'NEWA',
            'SELA': 'SEOA'
        };

        if (specialMap[c]) return specialMap[c];
        
        // 4文字で末尾がAならそのまま、それ以外で4文字以上なら3文字に切り詰め
        if (c.length >= 4) {
            if (c.endsWith('A')) {
                return c;
            }
            return c.substring(0, 3);
        }
        return c;
    };
    
    const ap = `${formatCity(departure)}.${formatCity(arrival)}`;
    
    // 日付フォーマット: dd-m-yyyy (例: 12-6-2026)
    const depDateFormatted = formatDateForTraveloka(departDate);
    const retDateFormatted = returnDate ? formatDateForTraveloka(returnDate) : "NA";
    
    // パラメータ構造を修正
    return `${baseURL}/${endpoint}?ap=${ap}&dt=${depDateFormatted}.${retDateFormatted}&ps=1.0.0&sc=ECONOMY`;
  };

  const generatePartnerAffiliateUrlViaApi = async (url: string): Promise<string> => {
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const endpoint = `${apiBase}/api/travelpayouts?url=${encodeURIComponent(url)}`;
      const response = await fetch(endpoint, { method: 'GET' });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TravelPayouts API request failed with status: ${response.status}. Body: ${errorText}`);
      }

      const data = await response.json() as { partner_url: string };
      if (typeof data.partner_url === 'string' && data.partner_url.length > 0) {
        return data.partner_url;
      }

      throw new Error('TravelPayouts API response did not contain partner_url');
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleConvert = async () => {
    setError('');
    setAffiliateUrl('');
    setShortUrl('');
    setTripUrl('');
    setTravelokaUrl('');
    setKiwiUrl('');
    setShareText('');
    setAffiliateCopyStatus('idle');
    setShortUrlCopyStatus('idle');
    setTripCopyStatus('idle');
    setTravelokaCopyStatus('idle');
    setKiwiCopyStatus('idle');
    setShareCopyStatus('idle');

    if (!inputUrl) {
      setError('URLを入力してください。');
      return;
    }

    setIsLoading(true);

    const normalized = normalizeInputUrl(inputUrl);
    if (!normalized) {
      setError('URLを入力してください。');
      setIsLoading(false);
      return;
    }

    try {
      new URL(normalized);
    } catch (_e) {
      setError('有効なURLを入力してください。');
      setIsLoading(false);
      return;
    }

    let parseTargetUrl = normalized;
    let parsedInput: URL;
    try {
      parsedInput = new URL(normalized);
    } catch (_e) {
      setError('有効なURLを入力してください。');
      setIsLoading(false);
      return;
    }

    // 片道/往復の判定精度を保つため、短縮URLは必ず展開してから判定する
    if (parsedInput.hostname.endsWith('skyscanner.app.link')) {
      try {
        parseTargetUrl = await expandShortUrl(normalized);
      } catch (e) {
        console.error(e);
        setError('短縮URLの展開に失敗しました。時間をおいて再試行してください。');
        setIsLoading(false);
        return;
      }
    }

    const parsed = parseSkyscannerUrl(parseTargetUrl);
    let trackingUrl: string;
    try {
      trackingUrl = await generateAffiliateUrlViaApi(normalized);
    } catch (e) {
      console.error(e);
      setError('アフィリエイトリンク生成APIの呼び出しに失敗しました。時間をおいて再試行してください。');
      setIsLoading(false);
      return;
    }
    setAffiliateUrl(trackingUrl);
    const sUrl = await shortenUrl(trackingUrl);
    setShortUrl(sUrl);

    let finalTripUrl = '';
    let finalTravelokaUrl = '';
    let finalKiwiUrl = '';

    if (parsed) {
      const { departure, arrival, departDate, returnDate } = parsed;
      
      try {
        if (tripComEnabled) {
          const tripDeepLink = generateTripURL(departure, arrival, departDate, returnDate);
          const tripAff = await generatePartnerAffiliateUrlViaApi(tripDeepLink);
          finalTripUrl = await shortenUrl(tripAff);
          setTripUrl(finalTripUrl);
        }

        if (travelokaEnabled) {
          const travelokaDeepLink = generateTravelokaURL(departure, arrival, departDate, returnDate);
          const travelokaAff = await generatePartnerAffiliateUrlViaApi(travelokaDeepLink);
          finalTravelokaUrl = await shortenUrl(travelokaAff);
          setTravelokaUrl(finalTravelokaUrl);
        }

        if (kiwiComEnabled) {
          const formatKiwi = (code: string) => {
            const c = code.toUpperCase();
            if (c === 'CSHA') return 'SHA';
            return c.substring(0, 3);
          };
          const kiwiDeparture = formatKiwi(departure);
          const kiwiArrival = formatKiwi(arrival);
          const kiwiDeepLink = `https://www.kiwi.com/deep?from=${kiwiDeparture}&to=${kiwiArrival}&departure=${formatDateForTrip(departDate)}${returnDate ? `&return=${formatDateForTrip(returnDate)}` : ''}`;
          const kiwiAff = `https://c111.travelpayouts.com/click?shmarker=731698&promo_id=3791&source_type=customlink&type=click&custom_url=${encodeURIComponent(kiwiDeepLink)}`;
          finalKiwiUrl = await shortenUrl(kiwiAff);
          setKiwiUrl(finalKiwiUrl);
        }
      } catch (e) {
        console.error('Alternative links generation failed:', e);
      }

      const routeArrow = parsed.returnDate ? ' <-> ' : ' -> ';
      const generatedShareText = generateShareText(sUrl, parsed, finalTripUrl, finalTravelokaUrl, finalKiwiUrl);
      setShareText(generatedShareText);
      addHistoryRecord({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        routeLabel: `${parsed.departure.toUpperCase()}${routeArrow}${parsed.arrival.toUpperCase()}`,
        dateLabel: parsed.returnDate ? `往路 ${parsed.departDate} / 復路 ${parsed.returnDate}` : `片道 ${parsed.departDate}`,
        tripLabel: parsed.returnDate ? '往復' : '片道',
        sourceUrl: normalized,
        affiliateUrl: trackingUrl,
        shortUrl: sUrl,
        tripUrl: finalTripUrl,
        travelokaUrl: finalTravelokaUrl,
        kiwiUrl: finalKiwiUrl,
        shareText: generatedShareText,
      });
    } else {
      // URL形式がSkyscannerの通常パスでなくても、変換自体はそのまま行う
      const fallbackShareText = generateShareText(sUrl, {
        departure: '',
        arrival: '',
        departDate: '',
      });
      setShareText(fallbackShareText);
      addHistoryRecord({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        routeLabel: '判別不可',
        dateLabel: '-',
        tripLabel: '不明',
        sourceUrl: normalized,
        affiliateUrl: trackingUrl,
        shortUrl: sUrl,
        shareText: fallbackShareText,
      });
    }
    setIsLoading(false);
  };

  const handleCopy = (text: string, type: 'affiliate' | 'short' | 'trip' | 'traveloka' | 'kiwi' | 'share') => {
    navigator.clipboard.writeText(text);
    if (type === 'affiliate') {
      setAffiliateCopyStatus('copied');
      setTimeout(() => setAffiliateCopyStatus('idle'), 2000);
    } else if (type === 'short') {
        setShortUrlCopyStatus('copied');
        setTimeout(() => setShortUrlCopyStatus('idle'), 2000);
    } else if (type === 'trip') {
      setTripCopyStatus('copied');
      setTimeout(() => setTripCopyStatus('idle'), 2000);
    } else if (type === 'traveloka') {
      setTravelokaCopyStatus('copied');
      setTimeout(() => setTravelokaCopyStatus('idle'), 2000);
    } else if (type === 'kiwi') {
      setKiwiCopyStatus('copied');
      setTimeout(() => setKiwiCopyStatus('idle'), 2000);
    } else {
      setShareCopyStatus('copied');
      setTimeout(() => setShareCopyStatus('idle'), 2000);
    }
  };

  const handlePasteClick = async () => {
    // フォールバック：入力フィールドにフォーカスして手動ペースト促促
    const textareaElement = document.querySelector('.skyscanner-tool textarea') as HTMLTextAreaElement;
    if (!textareaElement) {
      setError('入力フィールドが見つかりません。');
      return;
    }

    // Clipboard API が利用可能か確認
    if (!navigator.clipboard) {
      textareaElement.focus();
      setError('クリップボードへのアクセスが許可されていません。ここに直接ペーストしてください。');
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setInputUrl(text.trim());
        setShouldAutoConvert(true);
      } else {
        // クリップボードが空の場合は、フィールドにフォーカスして手動ペースト
        textareaElement.focus();
        setError('クリップボードが空です。ここに直接ペーストしてください。');
      }
    } catch (err) {
      console.error('Clipboard API エラー:', err);
      // Clipboard API が失敗した場合は入力フィールドにフォーカス
      textareaElement.focus();
      setError('クリップボードへのアクセスが許可されていません。ここに直接ペーストしてください。');
    }
  }

  // 貼り付け時に自動変換を実行
  useEffect(() => {
    if (shouldAutoConvert && inputUrl && !isLoading) {
      setShouldAutoConvert(false);
      // 次のフレームで実行（inputUrlの更新を確認してから）
      requestAnimationFrame(() => {
        handleConvert();
      });
    }
  }, [shouldAutoConvert, inputUrl, isLoading]);

  const handleReset = () => {
    setInputUrl('');
    setAffiliateUrl('');
    setShortUrl('');
    setTripUrl('');
    setTravelokaUrl('');
    setKiwiUrl('');
    setShareText('');
    setError('');
    setIsLoading(false);
    setAffiliateCopyStatus('idle');
    setShortUrlCopyStatus('idle');
    setTripCopyStatus('idle');
    setTravelokaCopyStatus('idle');
    setKiwiCopyStatus('idle');
    setShareCopyStatus('idle');
  }

  return (
    <div className="tool-page compact-page skyscanner-tool" style={{ paddingBottom: '2rem' }}>
        <div className="tool-page-hero">
          <h1>
            <span className="tool-page-illustration">
              <Link size={22} />
            </span>
            Skyscanner Link
          </h1>
        </div>

        <div className="card">
            <div className="history-header-row">
              <h2><Link size={20} /> URLを入力</h2>
              {onOpenHistory && (
                <button className="button history-open-button" type="button" onClick={onOpenHistory}>
                  <Clock3 size={16} />
                  <span>履歴</span>
                </button>
              )}
            </div>
          <p className="tool-description">Skyscannerのフライト検索結果ページURLを貼り付けてください。</p>
            <div className="input-group">
                <div className="input-with-button">
                    <textarea
                      id="skyscanner-url"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="https://skyscanner.app.link/Uk2vpgefS1b"
                      rows={4}
                      className="textarea-field"
                    />
                      <div className="input-action-buttons">
                        <button onClick={handleReset} className="button reset-button" type="button" disabled={!inputUrl && !affiliateUrl && !shortUrl && !shareText && !error}>
                          <X size={18} />
                          <span>リセット</span>
                        </button>
                        <button onClick={handlePasteClick} className="button paste-button" type="button">
                          <ClipboardPaste size={20} />
                          <span>貼り付け</span>
                        </button>
                      </div>
                </div>
            </div>
        </div>

        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}><Plane size={20} /> パートナー選択</h2>
              <button 
                type="button" 
                className="button" 
                style={{ 
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  backgroundColor: 'rgba(0, 122, 255, 0.1)',
                  color: '#007AFF',
                  fontWeight: '600',
                  borderRadius: '6px'
                }}
                onClick={() => {
                  setTripComEnabled(true);
                  setTravelokaEnabled(true);
                  setKiwiComEnabled(true);
                }}
              >
                すべて選択
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label className={`compact-toggle ${kiwiComEnabled ? 'active' : ''}`} style={{ padding: '8px 14px', fontSize: '0.95rem' }}>
                    <input 
                      type="checkbox" 
                      checked={kiwiComEnabled} 
                      onChange={(e) => setKiwiComEnabled(e.target.checked)} 
                    />
                    <span>kiwi</span>
                </label>
                <label className={`compact-toggle ${tripComEnabled ? 'active' : ''}`} style={{ padding: '8px 14px', fontSize: '0.95rem' }}>
                    <input 
                      type="checkbox" 
                      checked={tripComEnabled} 
                      onChange={(e) => setTripComEnabled(e.target.checked)} 
                    />
                    <span>Trip</span>
                </label>
                <label className={`compact-toggle ${travelokaEnabled ? 'active' : ''}`} style={{ padding: '8px 14px', fontSize: '0.95rem' }}>
                    <input 
                      type="checkbox" 
                      checked={travelokaEnabled} 
                      onChange={(e) => setTravelokaEnabled(e.target.checked)} 
                    />
                    <span>トラベロカ</span>
                </label>
            </div>
        </div>

      <button onClick={handleConvert} disabled={isLoading} className="button primary-button generate-button">
        {isLoading ? <Loader className="animate-spin" /> : <Link />}
        {isLoading ? '生成中...' : 'URLを生成'}
      </button>

      {error && (
        <div className="error-box">
          <AlertCircle />
          {error}
        </div>
      )}

      {(affiliateUrl || shortUrl || shareText || tripUrl || travelokaUrl || kiwiUrl) && (
        <div className="results-grid">
            {shareText && (
                <ResultBox 
                    title="シェアテキスト"
                    icon={<Share2 />}
                    content={shareText}
                    onCopy={() => handleCopy(shareText, 'share')}
                    copyStatus={shareCopyStatus}
                    colorClass="color-orange"
                />
            )}
            {shortUrl && (
                <ResultBox 
                    title="短縮URL"
                    icon={<Link />}
                    content={shortUrl}
                    onCopy={() => handleCopy(shortUrl, 'short')}
                    copyStatus={shortUrlCopyStatus}
                    colorClass="color-purple"
                />
            )}
            {kiwiUrl && (
                <ResultBox 
                    title="kiwi.com"
                    icon={<Plane />}
                    content={kiwiUrl}
                    onCopy={() => handleCopy(kiwiUrl, 'kiwi')}
                    copyStatus={kiwiCopyStatus}
                    colorClass="color-green"
                />
            )}
            {tripUrl && (
                <ResultBox 
                    title="Trip.com JP"
                    icon={<Plane />}
                    content={tripUrl}
                    onCopy={() => handleCopy(tripUrl, 'trip')}
                    copyStatus={tripCopyStatus}
                    colorClass="color-blue"
                />
            )}
            {travelokaUrl && (
                <ResultBox 
                    title="Traveloka JP"
                    icon={<Plane />}
                    content={travelokaUrl}
                    onCopy={() => handleCopy(travelokaUrl, 'traveloka')}
                    copyStatus={travelokaCopyStatus}
                    colorClass="color-cyan"
                />
            )}
            {affiliateUrl && (
                <ResultBox 
                    title="アフィリエイトURL"
                    icon={<CheckCircle />}
                    content={affiliateUrl}
                    onCopy={() => handleCopy(affiliateUrl, 'affiliate')}
                    copyStatus={affiliateCopyStatus}
                    colorClass="color-green"
                />
            )}
        </div>
      )}
    </div>
  );
};

export const SkyscannerHistoryPage: React.FC = () => {
  const [historySearch, setHistorySearch] = useState('');
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    setHistoryRecords(loadHistoryRecords());
  }, []);

  const refreshHistory = () => {
    setHistoryRecords(loadHistoryRecords());
  };

  const deleteHistoryRecord = (id: string) => {
    const next = historyRecords.filter((record) => record.id !== id);
    saveHistoryRecords(next);
    refreshHistory();
  };

  const clearHistory = () => {
    if (!window.confirm('すべての履歴を削除しますか？')) {
      return;
    }
    saveHistoryRecords([]);
    refreshHistory();
  };

  const copyText = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setCopyMessage(`${label}をコピーしました`);
      window.setTimeout(() => {
        setCopiedKey(null);
      }, 2600);
      window.setTimeout(() => {
        setCopyMessage(null);
      }, 3000);
    } catch (_e) {
      setCopyMessage('コピーに失敗しました');
      window.setTimeout(() => {
        setCopyMessage(null);
      }, 3000);
    }
  };

  const filteredHistory = historySearch.trim()
    ? historyRecords.filter((record) => {
        const q = historySearch.trim().toLowerCase();
        return (
          record.routeLabel.toLowerCase().includes(q)
          || record.dateLabel.toLowerCase().includes(q)
          || record.tripLabel.toLowerCase().includes(q)
          || record.shortUrl.toLowerCase().includes(q)
        );
      })
    : historyRecords;

  const normalizeRouteLabel = (label: string) => {
    if (label.includes('<->')) {
      return label.replace(/\s*<->\s*/g, ' <-> ');
    }
    return label.replace(/\s*->\s*/g, ' -> ');
  };

  return (
    <div className="tool-page compact-page skyscanner-tool history-page" style={{ paddingBottom: '2rem' }}>
      <div className="card history-card">
        <div className="history-header-row">
          <h2><Clock3 size={20} /> 生成履歴</h2>
          {historyRecords.length > 0 && (
            <button className="button history-clear-button" type="button" onClick={clearHistory}>
              <Trash2 size={16} />
              <span>すべて削除</span>
            </button>
          )}
        </div>

        <div className="history-search-row">
          <Search size={16} />
          <input
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="history-search-input"
            placeholder="履歴を検索"
          />
        </div>

        {filteredHistory.length === 0 ? (
          <p className="history-empty">履歴はありません</p>
        ) : (
          <div className="history-list">
            {filteredHistory.map((record) => (
              <div className="history-item" key={record.id}>
                <div className="history-item-top">
                  <span className={`history-tag ${record.tripLabel === '往復' ? 'round' : 'oneway'}`}>{record.tripLabel}</span>
                  <strong>{normalizeRouteLabel(record.routeLabel)}</strong>
                  <span className="history-date">{new Date(record.createdAt).toLocaleString('ja-JP')}</span>
                </div>
                <div className="history-item-sub">{record.dateLabel}</div>
                <button
                  className={`history-item-url history-item-url-button ${copiedKey === `${record.id}:short` ? 'copied' : ''}`}
                  type="button"
                  onClick={() => copyText(record.shortUrl, `${record.id}:short`, '短縮URL')}
                  title="短縮URLをコピー"
                >
                  {copiedKey === `${record.id}:short` ? 'コピー済み' : record.shortUrl}
                </button>
                <div className="history-actions">
                  <button className={`button history-action-btn ${copiedKey === `${record.id}:share` ? 'copied' : ''}`} type="button" onClick={() => copyText(record.shareText, `${record.id}:share`, 'シェア文')}>
                    {copiedKey === `${record.id}:share` ? 'コピー済み' : 'シェア文'}
                  </button>
                  {record.kiwiUrl && (
                    <button className={`button history-action-btn ${copiedKey === `${record.id}:kiwi` ? 'copied' : ''}`} type="button" onClick={() => copyText(record.kiwiUrl!, `${record.id}:kiwi`, 'kiwi.com')}>
                      {copiedKey === `${record.id}:kiwi` ? 'コピー済み' : 'kiwi.com'}
                    </button>
                  )}
                  {record.tripUrl && (
                    <button className={`button history-action-btn ${copiedKey === `${record.id}:trip` ? 'copied' : ''}`} type="button" onClick={() => copyText(record.tripUrl!, `${record.id}:trip`, 'Trip.com')}>
                      {copiedKey === `${record.id}:trip` ? 'コピー済み' : 'Trip.com'}
                    </button>
                  )}
                  {record.travelokaUrl && (
                    <button className={`button history-action-btn ${copiedKey === `${record.id}:traveloka` ? 'copied' : ''}`} type="button" onClick={() => copyText(record.travelokaUrl!, `${record.id}:traveloka`, 'Traveloka')}>
                      {copiedKey === `${record.id}:traveloka` ? 'コピー済み' : 'Traveloka'}
                    </button>
                  )}
                  <button className={`button history-action-btn ${copiedKey === `${record.id}:stats` ? 'copied' : ''}`} type="button" onClick={() => copyText(`${record.shortUrl}+`, `${record.id}:stats`, '統計用URL')}>
                    {copiedKey === `${record.id}:stats` ? 'コピー済み' : '統計用URL'}
                  </button>
                  <button className={`button history-action-btn ${copiedKey === `${record.id}:source` ? 'copied' : ''}`} type="button" onClick={() => copyText(record.sourceUrl, `${record.id}:source`, '元URL')}>
                    {copiedKey === `${record.id}:source` ? 'コピー済み' : '元URL'}
                  </button>
                  <button
                    className="button history-action-btn danger delete-action"
                    type="button"
                    onClick={() => deleteHistoryRecord(record.id)}
                    aria-label="この履歴を削除"
                    title="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {copyMessage && <div className="history-copy-toast">{copyMessage}</div>}
    </div>
  );
};

export default SkyscannerTool;
