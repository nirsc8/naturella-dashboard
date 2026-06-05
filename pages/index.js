import Head from 'next/head';
import useSWR from 'swr';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const fetcher = url => fetch(url).then(r => r.json());
const REFRESH = 120000;

const gc = 'rgba(0,0,0,0.06)';
const tc = '#888';

function KPI({ label, value, sub, color = 'neutral' }) {
  const bg = {
    green: '#e6f4ec', red: '#fde8e8', warn: '#fef3e2', neutral: '#f5f5f3'
  }[color];
  const cl = {
    green: '#1f7a43', red: '#c03030', warn: '#b06000', neutral: '#1a1a1a'
  }[color];
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '11px 13px' }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: cl, lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function fmtILS(n) {
  if (n == null) return '—';
  return '₪' + Math.round(n).toLocaleString('he-IL');
}

export default function Dashboard() {
  const { data, error, isLoading, mutate } = useSWR('/api/dashboard', fetcher, {
    refreshInterval: REFRESH,
  });

  const updated = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : null;

  const dailyLabels = data?.dailyPnL?.map(d => d.day) || [];
  const revData = data?.dailyPnL?.map(d => d.rev) || [];
  const spendData = data?.dailyPnL?.map(d => d.spend) || [];
  const profitData = data?.dailyPnL?.map(d => d.rev - d.spend) || [];

  const campNames = data?.meta?.campaigns?.slice(0,8).map(c =>
    c.name.length > 22 ? c.name.slice(0,22) + '…' : c.name
  ) || [];
  const campSpends = data?.meta?.campaigns?.slice(0,8).map(c => Math.round(c.spend)) || [];

  // Attribution — Zoho byCamp vs Meta spend
  const zohoAttr = data?.zoho?.byCamp || {};
  const metaCampMap = {};
  (data?.meta?.campaigns || []).forEach(c => { metaCampMap[c.name] = c.spend; });

  const attrRows = Object.entries(zohoAttr)
    .filter(([k]) => k !== 'ללא attribution')
    .map(([camp, z]) => {
      const spend = metaCampMap[camp] || 0;
      const roas = spend > 0 ? (z.rev / spend).toFixed(1) : null;
      return { camp: camp.length > 28 ? camp.slice(0,28)+'…' : camp, rev: z.rev, spend, roas, deals: z.count };
    })
    .sort((a, b) => b.rev - a.rev);

  const noAttr = zohoAttr['ללא attribution'];

  return (
    <>
      <Head>
        <title>נטורלה — דשבורד לייב</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>
      <main style={{ fontFamily: '-apple-system,sans-serif', direction: 'rtl', background: '#f5f5f3', minHeight: '100vh', padding: '1.25rem 1.5rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>דשבורד לייב — נטורלה 🌿</h1>
            <p style={{ fontSize: 12, color: '#888', margin: '3px 0 0' }}>
              Meta API + Zoho CRM · {isLoading ? 'טוען...' : updated ? `עודכן ${updated}` : ''}
            </p>
          </div>
          <button onClick={() => mutate()} style={{ fontSize: 13, padding: '6px 14px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
            ↻ רענן
          </button>
        </div>

        {error && (
          <div style={{ background: '#fde8e8', borderRadius: 10, padding: '12px 16px', marginBottom: 12, color: '#c03030' }}>
            שגיאה: {error.message || 'בדוק tokens'}
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginBottom: '1.25rem' }}>
          <KPI label="הכנסות החודש" value={isLoading ? '...' : fmtILS(data?.zoho?.totalRev)} sub={`${data?.zoho?.totalDeals || 0} עסקאות`} color="green" />
          <KPI label="הוצאת Meta" value={isLoading ? '...' : fmtILS(data?.meta?.totalSpend)} sub="החודש" color="red" />
          <KPI label="רווח נטו" value={isLoading ? '...' : fmtILS(data?.kpis?.netProfit)} sub="אחרי Meta" color="green" />
          <KPI label="ROAS" value={isLoading ? '...' : data?.kpis?.roas ? `${data.kpis.roas}x` : '—'} sub={data?.kpis?.roi != null ? `ROI ${data.kpis.roi}%` : ''} color="green" />
          <KPI label="CPL" value={isLoading ? '...' : fmtILS(data?.meta?.cpl)} sub={`${data?.meta?.totalLeads || 0} לידים`} />
          <KPI label="מרג'ין גולמי" value={isLoading ? '...' : data?.zoho?.margin ? `${data.zoho.margin}%` : '—'} sub={fmtILS(data?.zoho?.totalProfit)} color="green" />
          <KPI label="ממוצע עסקה" value={isLoading ? '...' : fmtILS(data?.kpis?.avgDeal)} />
          <KPI label="נפל" value={isLoading ? '...' : fmtILS(data?.zoho?.napalRev)} sub={`${data?.zoho?.napalCount || 0} עסקאות`} color="red" />
        </div>

        {/* Daily P&L Chart */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', padding: '1rem 1.25rem', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#666', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            הכנסות vs הוצאות Meta — לפי יום (₪)
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12, color: '#888', flexWrap: 'wrap' }}>
            <span>🟢 הכנסות</span><span>🔴 Meta</span><span>🔵 רווח נטו</span>
          </div>
          <div style={{ position: 'relative', height: 240 }}>
            <Bar data={{
              labels: dailyLabels,
              datasets: [
                { label: 'הכנסות', data: revData, backgroundColor: '#1D9E75', borderRadius: 4, borderSkipped: false },
                { label: 'Meta', data: spendData, backgroundColor: '#E24B4A', borderRadius: 4, borderSkipped: false },
                { label: 'רווח', data: profitData, backgroundColor: '#5DCAA5', borderRadius: 4, borderSkipped: false },
              ]
            }} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ₪${ctx.raw?.toLocaleString('he-IL')}` } } },
              scales: {
                x: { ticks: { color: tc, font: { size: 11 } }, grid: { color: gc } },
                y: { beginAtZero: true, ticks: { color: tc, font: { size: 10 }, callback: v => '₪' + v.toLocaleString('he-IL') }, grid: { color: gc } },
              }
            }} />
          </div>
        </div>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 12 }}>

          {/* Daily table */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#666', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>פירוט יומי מדויק</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  {['תאריך','הכנסות','Meta','רווח','ROAS','לידים'].map(h => (
                    <th key={h} style={{ textAlign: 'right', padding: '5px 6px', fontSize: 10, color: '#888', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.dailyPnL || []).slice().reverse().map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                    <td style={{ padding: '7px 6px', fontWeight: 500 }}>{d.day}</td>
                    <td style={{ padding: '7px 6px', color: '#1f7a43' }}>₪{d.rev?.toLocaleString('he-IL')}</td>
                    <td style={{ padding: '7px 6px', color: '#c03030' }}>₪{d.spend?.toLocaleString('he-IL')}</td>
                    <td style={{ padding: '7px 6px', color: d.rev - d.spend > 0 ? '#1f7a43' : '#c03030' }}>₪{(d.rev - d.spend)?.toLocaleString('he-IL')}</td>
                    <td style={{ padding: '7px 6px', fontWeight: 500, color: d.roas >= 5 ? '#1f7a43' : d.roas >= 3 ? '#b06000' : '#c03030' }}>{d.roas ? `${d.roas}x` : '—'}</td>
                    <td style={{ padding: '7px 6px', color: '#888' }}>{d.leads || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Campaign spend */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#666', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>הוצאה לפי קמפיין</div>
            <div style={{ position: 'relative', height: 220 }}>
              <Bar data={{
                labels: campNames,
                datasets: [{ data: campSpends, backgroundColor: '#3266ad', borderRadius: 4, borderSkipped: false }]
              }} options={{
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ₪${ctx.raw?.toLocaleString('he-IL')}` } } },
                scales: {
                  x: { ticks: { color: tc, font: { size: 10 }, callback: v => '₪' + v.toLocaleString('he-IL') }, grid: { color: gc } },
                  y: { ticks: { color: tc, font: { size: 10 } }, grid: { display: false } },
                }
              }} />
            </div>
          </div>
        </div>

        {/* Attribution table */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', padding: '1rem 1.25rem', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#666', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            Attribution — קמפיין Meta × עסקאות Zoho
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                {['קמפיין','הכנסות מיוחסות','הוצאה','ROAS','עסקאות'].map(h => (
                  <th key={h} style={{ textAlign: 'right', padding: '5px 6px', fontSize: 10, color: '#888', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attrRows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                  <td style={{ padding: '7px 6px', fontWeight: 500, fontSize: 11 }}>{r.camp}</td>
                  <td style={{ padding: '7px 6px', color: '#1f7a43' }}>₪{Math.round(r.rev).toLocaleString('he-IL')}</td>
                  <td style={{ padding: '7px 6px', color: '#c03030' }}>{r.spend > 0 ? `₪${Math.round(r.spend).toLocaleString('he-IL')}` : '—'}</td>
                  <td style={{ padding: '7px 6px', fontWeight: 500, color: r.roas >= 4 ? '#1f7a43' : r.roas >= 2 ? '#b06000' : '#c03030' }}>
                    {r.roas ? `${r.roas}x` : '—'}
                  </td>
                  <td style={{ padding: '7px 6px', color: '#888' }}>{r.deals}</td>
                </tr>
              ))}
              {noAttr && (
                <tr style={{ borderBottom: '1px solid #f8f8f8', opacity: .7 }}>
                  <td style={{ padding: '7px 6px', color: '#888', fontSize: 11 }}>ללא attribution</td>
                  <td style={{ padding: '7px 6px' }}>₪{Math.round(noAttr.rev).toLocaleString('he-IL')}</td>
                  <td style={{ padding: '7px 6px', color: '#888' }}>—</td>
                  <td style={{ padding: '7px 6px', color: '#888' }}>—</td>
                  <td style={{ padding: '7px 6px', color: '#888' }}>{noAttr.count}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 8 }}>
            * attribution לפי שדה CRcampaign ב-Zoho · עסקאות ללא שדה = לא מיוחסות
          </div>
        </div>

        {/* Recent leads */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#666', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>לידים אחרונים</div>
          {(data?.leads || []).map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>
              <span>{l.name}</span>
              <span style={{ color: '#888', fontSize: 12 }}>{l.time} · {l.source || '—'}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 12 }}>
          מתעדכן כל 2 דקות · Meta Graph API + Zoho CRM · כל הנתונים בזמן אמת
        </div>
      </main>
    </>
  );
}
