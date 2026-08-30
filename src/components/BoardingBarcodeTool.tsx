import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  PlaneTakeoff,
  Ticket,
  Hash,
  Copy,
  QrCode,
  AlertCircle,
  Clock3,
  Trash2,
  X,
  Plus,
  Check,
} from 'lucide-react';

declare global {
  interface Window {
    Module: any;
  }
}

export interface BoardingHistoryRecord {
  id: string;
  createdAt: number;
  label: string;
  firstName: string;
  lastName: string;
  from: string;
  to: string;
  operator: string;
  flightNum: string;
  date: string;
  bookingRef: string;
  seat: string;
  boardingIndex: string;
  cabinClass: string;
  rawData: string;
}

const HISTORY_STORAGE_KEY = 'boarding_barcode_history_v1';

const loadHistoryRecords = (): BoardingHistoryRecord[] => {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load history:', e);
    return [];
  }
};

const saveHistoryRecords = (records: BoardingHistoryRecord[]) => {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records));
};

// 旧形式(生データのみ)の履歴レコードを新形式に変換する
const migrateLegacyRecord = (record: any): BoardingHistoryRecord => {
  if (typeof record?.firstName === 'string') {
    return record;
  }
  const raw: string = typeof record?.rawData === 'string' ? record.rawData : '';
  let firstName = '';
  let lastName = '';
  let from = '';
  let to = '';
  let operator = '';
  let flightNum = '';
  let bookingRef = '';
  let seat = '';
  let boardingIndex = '';
  let cabinClass = 'Y';
  let date = new Date().toISOString().slice(0, 10);

  // M1 + 氏名(20) + E + PNR(7) + 出発(3) + 到着(3) + 会社(3) + 便名(5) + 日付(3) + クラス(1) + 座席(4) + 連番(5)
  if (raw.startsWith('M1') && raw.length >= 57) {
    const nameField = raw.substring(2, 22);
    const slashIndex = nameField.indexOf('/');
    lastName = (slashIndex >= 0 ? nameField.substring(0, slashIndex) : nameField).trim();
    firstName = slashIndex >= 0 ? nameField.substring(slashIndex + 1).trim() : '';
    bookingRef = raw.substring(23, 30).trim();
    from = raw.substring(30, 33).trim();
    to = raw.substring(33, 36).trim();
    operator = raw.substring(36, 39).trim();
    flightNum = raw.substring(39, 44).trim();
    const doy = parseInt(raw.substring(44, 47), 10);
    cabinClass = raw.substring(47, 48).trim() || 'Y';
    seat = raw.substring(48, 52).trim().replace(/^0+(?=.)/, '');
    const seq = parseInt(raw.substring(52, 57), 10);
    boardingIndex = Number.isNaN(seq) ? '' : String(seq);
    if (!Number.isNaN(doy) && doy >= 1 && doy <= 366) {
      // 年は保存日時から推定(生データには年が含まれないため)
      const year = new Date(record?.createdAt ?? Date.now()).getFullYear();
      const parsed = new Date(year, 0, doy);
      date = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }

  return {
    ...record,
    firstName,
    lastName,
    from,
    to,
    operator,
    flightNum,
    date,
    bookingRef,
    seat,
    boardingIndex,
    cabinClass,
  };
};

const BoardingBarcodeTool: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [operator, setOperator] = useState('');
  const [flightNum, setFlightNum] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookingRef, setBookingRef] = useState(Math.random().toString(36).substring(2, 8).toUpperCase());
  const [seat, setSeat] = useState('');
  const [boardingIndex, setBoardingIndex] = useState(Math.floor(Math.random() * 200 + 1).toString());
  const [cabinClass, setCabinClass] = useState('Y');
  const [codeType, setCodeType] = useState('0');
  const [rawData, setRawData] = useState('');
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('コピー');
  
  const [history, setHistory] = useState<BoardingHistoryRecord[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<any>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  useEffect(() => {
    setHistory(loadHistoryRecords().map(migrateLegacyRecord));
  }, []);

  const upPadRight = (s: string, n: number) => {
    s = s.toUpperCase();
    while (s.length < n) s += ' ';
    return s.substring(0, n);
  };

  const padLeft = (s: string, n: number) => {
    s = s.toUpperCase();
    while (s.length < n) s = '0' + s;
    return s.substring(0, n);
  };

  const getDayOfYear = (dateStr: string) => {
    const d = new Date(dateStr);
    const start = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay) + 1;
  };

  const updateBarcode = useCallback((text: string) => {
    if (!window.Module || !window.Module.cwrap || !canvasRef.current) return;

    if (!runRef.current) {
      runRef.current = window.Module.cwrap('run', null, ['number', 'string', 'number', 'number']);
    }

    const ecc = 0;
    const ssize = codeType === '0' ? 11 : 6;

    runRef.current(parseInt(codeType, 10), text, ecc, ssize);

    const svgContent = (window as any).textOut;
    if (svgContent) {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          }
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  }, [codeType]);

  useEffect(() => {
    setError('');

    if (firstName.length + lastName.length > 19) {
      setError('氏名が長すぎます（姓+名の合計は最大19文字）');
    }

    const nameField = upPadRight(`${lastName}/${firstName}`, 20);
    const refField = upPadRight(bookingRef, 7);
    const fromField = upPadRight(from, 3);
    const toField = upPadRight(to, 3);
    const opField = upPadRight(operator, 3);
    const fnField = upPadRight(flightNum, 5);
    const dateField = padLeft(getDayOfYear(date).toString(), 3);
    const seatField = padLeft(seat, 4);
    const seqField = upPadRight(padLeft(boardingIndex, 4), 5);

    const formatted = `M1${nameField}E${refField}${fromField}${toField}${opField}${fnField}${dateField}${cabinClass}${seatField}${seqField}100`;

    setRawData(formatted);
    updateBarcode(formatted);
  }, [
    firstName,
    lastName,
    from,
    to,
    operator,
    flightNum,
    date,
    bookingRef,
    seat,
    boardingIndex,
    cabinClass,
    updateBarcode,
  ]);

  const handleCopy = (text: string = rawData) => {
    navigator.clipboard.writeText(text);
    setCopyStatus('コピーしました');
    setTimeout(() => setCopyStatus('コピー'), 2000);
  };

  const missingFieldLabels: { key: string; label: string; empty: boolean }[] = [
    { key: 'firstName', label: '名', empty: firstName.trim() === '' },
    { key: 'lastName', label: '姓', empty: lastName.trim() === '' },
    { key: 'from', label: '出発地', empty: from.trim() === '' },
    { key: 'to', label: '到着地', empty: to.trim() === '' },
    { key: 'operator', label: '運航会社コード', empty: operator.trim() === '' },
    { key: 'flightNum', label: '便名', empty: flightNum.trim() === '' },
    { key: 'date', label: '出発日', empty: date.trim() === '' },
    { key: 'bookingRef', label: 'PNR', empty: bookingRef.trim() === '' },
    { key: 'seat', label: '座席番号', empty: seat.trim() === '' },
    { key: 'boardingIndex', label: '搭乗インデックス', empty: boardingIndex.trim() === '' },
  ];
  const missingFields = missingFieldLabels.filter((f) => f.empty);
  const isFormComplete = missingFields.length === 0;

  const handleSaveToHistory = () => {
    if (!isFormComplete) {
      setError(`保存できません。次の項目を入力してください: ${missingFields.map((f) => f.label).join('・')}`);
      return;
    }
    setError('');
    const label = `${from || '???'} -> ${to || '???'} (${operator}${flightNum || '???'})`;
    const newRecord: BoardingHistoryRecord = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      label,
      firstName,
      lastName,
      from,
      to,
      operator,
      flightNum,
      date,
      bookingRef,
      seat,
      boardingIndex,
      cabinClass,
      rawData,
    };
    const next = [newRecord, ...history].slice(0, 50);
    setHistory(next);
    saveHistoryRecords(next);
  };

  const handleApplyHistory = (record: BoardingHistoryRecord) => {
    // 旧形式レコード(項目データなし)でもクラッシュしないようフォールバックを付ける
    setFirstName(record.firstName ?? '');
    setLastName(record.lastName ?? '');
    setFrom(record.from ?? '');
    setTo(record.to ?? '');
    setOperator(record.operator ?? '');
    setFlightNum(record.flightNum ?? '');
    setDate(record.date || new Date().toISOString().slice(0, 10));
    setBookingRef(record.bookingRef ?? '');
    setSeat(record.seat ?? '');
    setBoardingIndex(record.boardingIndex ?? '');
    setCabinClass(record.cabinClass ?? 'Y');
    setIsHistoryOpen(false);
  };

  const handleDeleteHistory = (id: string) => {
    const next = history.filter(r => r.id !== id);
    setHistory(next);
    saveHistoryRecords(next);
  };

  return (
    <div className="tool-page compact-page">
      <div className="tool-page-hero">
        <h1>
          <span className="tool-page-illustration">
            <PlaneTakeoff size={22} />
          </span>
          Boarding Barcode
        </h1>
      </div>

      <div className="history-header-row" style={{ marginBottom: '1rem' }}>
        <div style={{ flex: 1 }} />
        <button className="button history-open-button" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
          <Clock3 size={16} />
          <span>履歴</span>
        </button>
      </div>

      {isHistoryOpen && (
        <div className="card">
          <div className="history-header-row">
            <h2><Clock3 size={20} /> 履歴</h2>
            <button className="button reset-button" onClick={() => setIsHistoryOpen(false)} style={{ padding: '4px' }}>
              <X size={18} />
            </button>
          </div>
          {history.length === 0 ? (
            <p className="history-empty">履歴はありません</p>
          ) : (
            <div className="history-list">
              {history.map(record => (
                <div key={record.id} className="history-item">
                  <div className="history-item-top">
                    <strong>{record.label}</strong>
                    <span className="history-date">{new Date(record.createdAt).toLocaleString('ja-JP')}</span>
                  </div>
                  <div className="history-actions" style={{ marginTop: '0.5rem' }}>
                    <button className="button history-action-btn" onClick={() => handleApplyHistory(record)}>
                      <Check size={14} /> この内容を適用
                    </button>
                    <button className="button history-action-btn" onClick={() => handleCopy(record.rawData)}>
                      <Copy size={14} /> 生データをコピー
                    </button>
                    <button className="button history-action-btn danger delete-action" onClick={() => handleDeleteHistory(record.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error-msg" ref={errorRef}>
          <AlertCircle size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
          {error}
        </div>
      )}

      <div className="card">
        <h2><User size={20} /> 乗客情報</h2>
        <div className="input-grid-2">
          <div className="input-field">
            <label>名</label>
            <input type="text" value={firstName} placeholder="JOHN" onChange={(e) => setFirstName(e.target.value.toUpperCase())} />
          </div>
          <div className="input-field">
            <label>姓</label>
            <input type="text" value={lastName} placeholder="DOE" onChange={(e) => setLastName(e.target.value.toUpperCase())} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2><PlaneTakeoff size={20} /> 区間・便情報</h2>
        <div className="input-grid-2">
          <div className="input-field">
            <label>出発地</label>
            <input type="text" value={from} placeholder="ZRH" onChange={(e) => setFrom(e.target.value.toUpperCase())} maxLength={3} />
          </div>
          <div className="input-field">
            <label>到着地</label>
            <input type="text" value={to} placeholder="SFO" onChange={(e) => setTo(e.target.value.toUpperCase())} maxLength={3} />
          </div>
        </div>
        <div className="input-grid-2" style={{ marginTop: '1.25rem' }}>
          <div className="input-field">
            <label>運航会社コード</label>
            <input type="text" value={operator} placeholder="BA" onChange={(e) => setOperator(e.target.value.toUpperCase())} maxLength={3} />
          </div>
          <div className="input-field">
            <label>便名</label>
            <input type="text" value={flightNum} placeholder="1234" onChange={(e) => setFlightNum(e.target.value)} maxLength={5} />
          </div>
        </div>
        <div className="input-field" style={{ marginTop: '1.25rem' }}>
          <label>出発日</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <h2><Ticket size={20} /> クラス・座席</h2>
        <div className="input-grid-2">
          <div className="input-field">
            <label>搭乗クラス</label>
            <select value={cabinClass} onChange={(e) => setCabinClass(e.target.value)}>
              <option value="Y">エコノミー (Y)</option>
              <option value="C">ビジネス (C)</option>
              <option value="F">ファースト (F)</option>
            </select>
          </div>
          <div className="input-field">
            <label>座席番号</label>
            <input type="text" value={seat} placeholder="35A" onChange={(e) => setSeat(e.target.value.toUpperCase())} maxLength={4} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2><Hash size={20} /> 参照情報</h2>
        <div className="input-grid-2">
          <div className="input-field">
            <label>PNR</label>
            <input type="text" value={bookingRef} onChange={(e) => setBookingRef(e.target.value.toUpperCase())} maxLength={7} />
          </div>
          <div className="input-field">
            <label>搭乗インデックス</label>
            <input type="text" value={boardingIndex} onChange={(e) => setBoardingIndex(e.target.value)} maxLength={4} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2><QrCode size={20} /> 出力</h2>
        <div className="input-field">
          <label>バーコード形式</label>
          <select value={codeType} onChange={(e) => setCodeType(e.target.value)}>
            <option value="0">Aztec（標準）</option>
            <option value="1">PDF417</option>
          </select>
        </div>

        <div className="barcode-result" style={{ marginTop: '1.5rem' }}>
          <canvas ref={canvasRef} />
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            生成されたバーコード（{codeType === '0' ? 'Aztec' : 'PDF417'}）
          </div>
        </div>

        <div className="input-field" style={{ marginTop: '1.5rem' }}>
          <label>IATA生データ文字列</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="text" value={rawData} readOnly style={{ flex: '1 0 200px', backgroundColor: '#f1f5f9' }} />
            <button className="button" onClick={() => handleCopy()}>
              <Copy size={18} /> {copyStatus}
            </button>
            <button
              className="button primary-button"
              onClick={handleSaveToHistory}
              title={isFormComplete ? '履歴に保存' : '未入力の項目があります'}
            >
              <Plus size={18} /> 履歴に保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardingBarcodeTool;