import React, { useMemo, useState } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import {
  Calculator,
  TrendingUp,
  Flame,
  PieChart,
  ArrowDownCircle,
  ArrowUpCircle,
  Table as TableIcon,
} from 'lucide-react';

interface SimResult {
  age: number;
  startAssets: number;
  investment: number;
  returnAmount: number;
  endAssets: number;
}

const FireSimulatorTool: React.FC = () => {
  const [birthYear, setBirthYear] = useState<string>('1997');
  const [birthMonth, setBirthMonth] = useState<string>('7');
  const [initialCapital, setInitialCapital] = useState<string>('500');
  const [monthlyInvestment, setMonthlyInvestment] = useState<string>('10');
  const [realReturn, setRealReturn] = useState<string>('5');
  const [retirementAge, setRetirementAge] = useState<string>('35');
  const [annualExpensesAfterRetirement, setAnnualExpensesAfterRetirement] = useState<string>('300');

  const [usePension, setUsePension] = useState<boolean>(false);
  const [pensionStartAge, setPensionStartAge] = useState<string>('65');
  const [annualExpensesAfterPension, setAnnualExpensesAfterPension] = useState<string>('200');

  const parseNum = (val: string): number => {
    const sanitized = val
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[^0-9.]/g, '');
    return parseFloat(sanitized) || 0;
  };

  const ageOptions = useMemo(() => Array.from({ length: 81 }, (_, i) => 20 + i), []);

  const simulationData = useMemo(() => {
    const results: SimResult[] = [];
    const today = new Date();
    const birthDate = `${birthYear}-${String(birthMonth).padStart(2, '0')}`;
    const birth = new Date(birthDate);

    const nCurrentAge = Math.floor((today.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    const nInitialCapital = parseNum(initialCapital);
    const nMonthlyInvestment = parseNum(monthlyInvestment);
    const nRealReturn = parseNum(realReturn);
    const nRetirementAge = Math.floor(parseNum(retirementAge));
    const nAnnualExpensesAfterRetirement = parseNum(annualExpensesAfterRetirement);
    const nPensionStartAge = parseNum(pensionStartAge);
    const nAnnualExpensesAfterPension = parseNum(annualExpensesAfterPension);

    let currentAssets = nInitialCapital;
    const endAge = 110;

    if (nCurrentAge <= 0) return [];

    for (let age = nCurrentAge; age <= endAge; age++) {
      const startAssets = Math.max(0, currentAssets);
      let investment = 0;
      let expenses = 0;

      if (age < nRetirementAge) {
        investment = nMonthlyInvestment * 12;
      } else {
        expenses = nAnnualExpensesAfterRetirement;
        if (usePension && age >= nPensionStartAge) {
          expenses = nAnnualExpensesAfterPension;
        }
      }

      const flow = investment - expenses;
      const baseForReturn = startAssets + flow;
      const returnAmount = baseForReturn > 0 ? (baseForReturn * nRealReturn) / 100 : 0;
      const endAssets = Math.max(0, Math.round(baseForReturn + returnAmount));

      results.push({
        age,
        startAssets: Math.round(startAssets),
        investment: flow,
        returnAmount: Math.round(returnAmount),
        endAssets,
      });

      currentAssets = endAssets;
      if (currentAssets <= 0 && age > nRetirementAge) break;
    }
    return results;
  }, [
    birthYear,
    birthMonth,
    initialCapital,
    monthlyInvestment,
    realReturn,
    retirementAge,
    annualExpensesAfterRetirement,
    usePension,
    pensionStartAge,
    annualExpensesAfterPension,
  ]);

  const nRetirementAge = useMemo(() => Math.floor(parseNum(retirementAge)), [retirementAge]);

  const assetsRunOutAge = useMemo(() => {
    const runOut = simulationData.find((d) => d.endAssets <= 0 && d.age > nRetirementAge);
    return runOut ? runOut.age : null;
  }, [simulationData, nRetirementAge]);

  const retirementAssets = useMemo(() => {
    return simulationData.find((d) => d.age >= nRetirementAge)?.startAssets || 0;
  }, [simulationData, nRetirementAge]);

  return (
    <div className="tool-page compact-page" style={{ paddingBottom: '2rem' }}>
      <div className="tool-page-hero">
        <h1>
          <span className="tool-page-illustration">
            <Flame size={22} />
          </span>
          FIRE Simulator
        </h1>
      </div>

      <div className="card">
        <h2><Calculator size={20} /> シミュレーション条件</h2>
        <div className="input-grid">
          <div className="input-field">
            <label>生年月</label>
            <div className="date-select-container">
              <select value={birthYear} onChange={(e) => setBirthYear(e.target.value)}>
                {Array.from({ length: 2070 - 1950 + 1 }, (_, i) => 1950 + i).map((year) => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
              <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => 1 + i).map((month) => (
                  <option key={month} value={month}>{month}月</option>
                ))}
              </select>
            </div>
          </div>
          <div className="input-field">
            <label>元金（万円）</label>
            <input type="text" value={initialCapital} onChange={(e) => setInitialCapital(e.target.value)} />
          </div>
          <div className="input-field">
            <label>毎月積み立て額（万円）</label>
            <input type="text" value={monthlyInvestment} onChange={(e) => setMonthlyInvestment(e.target.value)} />
          </div>
          <div className="input-field">
            <label>実質リターン（％）</label>
            <input type="text" value={realReturn} onChange={(e) => setRealReturn(e.target.value)} />
          </div>
          <div className="input-field">
            <label>リタイア年齢（歳）</label>
            <select value={retirementAge} onChange={(e) => setRetirementAge(e.target.value)}>
              {ageOptions.map((age) => (
                <option key={age} value={age}>{age}歳</option>
              ))}
            </select>
          </div>
          <div className="input-field">
            <label>リタイア後の年間支出（万円）</label>
            <input type="text" value={annualExpensesAfterRetirement} onChange={(e) => setAnnualExpensesAfterRetirement(e.target.value)} />
          </div>
        </div>

        <label className="pension-toggle">
          <input type="checkbox" checked={usePension} onChange={(e) => setUsePension(e.target.checked)} />
          <span>年金情報を考慮する</span>
        </label>

        {usePension && (
          <div className="input-grid" style={{ marginTop: '1.25rem' }}>
            <div className="input-field">
              <label>年金受給開始年齢（歳）</label>
              <select value={pensionStartAge} onChange={(e) => setPensionStartAge(e.target.value)}>
                {ageOptions.map((age) => (
                  <option key={age} value={age}>{age}歳</option>
                ))}
              </select>
            </div>
            <div className="input-field">
              <label>受給開始後の年間支出（万円）</label>
              <input type="text" value={annualExpensesAfterPension} onChange={(e) => setAnnualExpensesAfterPension(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2><TrendingUp size={20} /> シミュレーション結果</h2>
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-label">リタイア時の資産</div>
            <div className="summary-value" style={{ color: '#3b82f6' }}>
              {retirementAssets.toLocaleString()} <span style={{ fontSize: '1rem' }}>万円</span>
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label">資産寿命</div>
            <div className="summary-value" style={{ color: assetsRunOutAge ? '#ef4444' : '#10b981' }}>
              {assetsRunOutAge ? `${assetsRunOutAge} 歳` : '110 歳+'}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2><PieChart size={20} /> 資産推移グラフ</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={simulationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="age" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `${v / 10000}億`} />
              <Tooltip
                contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [`${Number(value).toLocaleString()} 万円`, '総資産']}
              />
              <Area type="monotone" dataKey="endAssets" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAssets)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2><TableIcon size={20} /> 年間推移詳細</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>年齢</th>
                <th>年初資産</th>
                <th>年間収支</th>
                <th>運用益</th>
                <th>年末合計</th>
              </tr>
            </thead>
            <tbody>
              {simulationData.map((data) => (
                <tr key={data.age}>
                  <td className="age-col">{data.age} 歳</td>
                  <td>{data.startAssets.toLocaleString()}</td>
                  <td className={data.investment >= 0 ? 'positive' : 'negative'}>
                    {data.investment > 0
                      ? <ArrowUpCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      : <ArrowDownCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />}
                    {data.investment.toLocaleString()}
                  </td>
                  <td>{data.returnAmount.toLocaleString()}</td>
                  <td><strong>{data.endAssets.toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FireSimulatorTool;