import { getDealsThisMonth, getRecentLeads, summarize } from '../../lib/zoho';
import { getDailyInsights, getCampaignInsights, parseLeads } from '../../lib/meta';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
  try {
    const [deals, leads, dailyMeta, campMeta] = await Promise.all([
      getDealsThisMonth(),
      getRecentLeads(),
      getDailyInsights(),
      getCampaignInsights(),
    ]);

    const zoho = summarize(deals);

    // Meta daily
    const metaByDay = {};
    let totalMetaSpend = 0;
    let totalLeads = 0;
    for (const r of dailyMeta) {
      const leads = parseLeads(r.actions);
      metaByDay[r.date_start] = {
        spend: parseFloat(r.spend),
        impressions: parseInt(r.impressions),
        clicks: parseInt(r.clicks),
        ctr: parseFloat(r.ctr),
        leads,
      };
      totalMetaSpend += parseFloat(r.spend);
      totalLeads += leads;
    }

    // Meta campaigns
    const metaCamps = campMeta.map(c => ({
      name: c.campaign_name,
      spend: parseFloat(c.spend),
      leads: parseLeads(c.actions),
    })).sort((a, b) => b.spend - a.spend);

    // Combined daily P&L
    const allDays = [...new Set([
      ...Object.keys(zoho.byDay),
      ...Object.keys(metaByDay),
    ])].sort();

    const dailyPnL = allDays.map(day => {
      const z = zoho.byDay[day] || { rev: 0, profit: 0, count: 0 };
      const m = metaByDay[day] || { spend: 0, leads: 0, ctr: 0 };
      return {
        day: day.slice(5),
        rev: Math.round(z.rev),
        profit: Math.round(z.profit),
        deals: z.count,
        spend: Math.round(m.spend),
        leads: m.leads,
        ctr: parseFloat(m.ctr?.toFixed(2) || 0),
        roas: m.spend > 0 ? parseFloat((z.rev / m.spend).toFixed(1)) : null,
        cpl: m.leads > 0 ? Math.round(m.spend / m.leads) : null,
      };
    });

    const roas = totalMetaSpend > 0
      ? parseFloat((zoho.totalRev / totalMetaSpend).toFixed(1))
      : null;

    res.json({
      updatedAt: new Date().toISOString(),
      zoho: {
        totalRev: Math.round(zoho.totalRev),
        totalProfit: Math.round(zoho.totalProfit),
        totalDeals: zoho.totalDeals,
        napalRev: Math.round(zoho.napalRev),
        napalCount: zoho.napalCount,
        margin: zoho.totalRev > 0
          ? Math.round(zoho.totalProfit / zoho.totalRev * 100)
          : 0,
        byCamp: zoho.byCamp,
        recentDeals: zoho.recentDeals,
      },
      meta: {
        totalSpend: Math.round(totalMetaSpend),
        totalLeads,
        cpl: totalLeads > 0 ? Math.round(totalMetaSpend / totalLeads) : null,
        campaigns: metaCamps,
      },
      kpis: {
        roas,
        roi: totalMetaSpend > 0
          ? Math.round((zoho.totalRev - totalMetaSpend) / totalMetaSpend * 100)
          : null,
        netProfit: Math.round(zoho.totalRev - totalMetaSpend),
        avgDeal: zoho.totalDeals > 0
          ? Math.round(zoho.totalRev / zoho.totalDeals)
          : 0,
      },
      dailyPnL,
      leads: leads.slice(0, 10).map(l => ({
        name: [l.First_Name, l.Last_Name].filter(Boolean).join(' ') || '—',
        time: l.Created_Time?.slice(11, 16),
        source: l.Lead_Source,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
