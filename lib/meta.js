const BASE = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.META_ACCESS_TOKEN;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID;

async function metaGet(path, params = {}) {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set('access_token', TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Meta API ${res.status}`);
  return res.json();
}

export async function getDailyInsights() {
  const d = await metaGet(`${ACCOUNT}/insights`, {
    fields: 'spend,impressions,clicks,ctr,actions',
    time_increment: '1',
    date_preset: 'this_month',
    level: 'account',
  });
  return d.data || [];
}

export async function getCampaignInsights() {
  const d = await metaGet(`${ACCOUNT}/insights`, {
    fields: 'campaign_name,spend,actions',
    date_preset: 'this_month',
    level: 'campaign',
    limit: '50',
  });
  return d.data || [];
}

export function parseLeads(actions = []) {
  return parseInt(actions.find(a => a.action_type === 'lead')?.value || 0);
}
