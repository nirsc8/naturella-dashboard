let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Zoho token error');
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function zohoQuery(query) {
  const token = await getToken();
  const res = await fetch(`${process.env.ZOHO_API_DOMAIN}/crm/v6/coql`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ select_query: query }),
  });
  if (!res.ok) throw new Error(`Zoho API ${res.status}`);
  return res.json();
}

export async function getDealsThisMonth() {
  const today = new Date();
  const firstDay = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
  const todayStr = today.toISOString().slice(0,10);
  const d = await zohoQuery(
    `SELECT Deal_Name, Stage, SumPrice, profit, Closing_Date, CRcampaign, CRtype, CRsource
     FROM Deals
     WHERE Closing_Date >= '${firstDay}' AND Closing_Date <= '${todayStr}'
     LIMIT 200`
  );
  return d.data || [];
}

export async function getRecentLeads() {
  const d = await zohoQuery(
    `SELECT First_Name, Last_Name, Lead_Source, Lead_Status, Created_Time
     FROM Leads
     ORDER BY Created_Time DESC
     LIMIT 20`
  );
  return d.data || [];
}

export function summarize(deals) {
  const active = deals.filter(d => ['סגור','גביה'].includes(d.Stage));
  const napal = deals.filter(d => d.Stage === 'נפל');
  const byDay = {};
  const byCamp = {};

  for (const d of active) {
    const day = d.Closing_Date;
    if (!byDay[day]) byDay[day] = { rev: 0, profit: 0, count: 0 };
    byDay[day].rev += d.SumPrice || 0;
    byDay[day].profit += d.profit || 0;
    byDay[day].count++;

    const camp = d.CRcampaign || 'ללא attribution';
    if (!byCamp[camp]) byCamp[camp] = { rev: 0, profit: 0, count: 0 };
    byCamp[camp].rev += d.SumPrice || 0;
    byCamp[camp].profit += d.profit || 0;
    byCamp[camp].count++;
  }

  return {
    totalRev: active.reduce((s, d) => s + (d.SumPrice || 0), 0),
    totalProfit: active.reduce((s, d) => s + (d.profit || 0), 0),
    totalDeals: active.length,
    napalRev: napal.reduce((s, d) => s + (d.SumPrice || 0), 0),
    napalCount: napal.length,
    byDay,
    byCamp,
    recentDeals: deals.slice(0, 10),
  };
}
