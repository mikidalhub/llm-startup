import { readFile, writeFile } from 'node:fs/promises';

const now = new Date();
const nextTrade = new Date(Date.UTC(2026, 3, 15, 6, 30, 0));

const dashboardPath = new URL('../public/data/dashboard.json', import.meta.url);
const kpiPath = new URL('../public/data/kpis.json', import.meta.url);

const dashboard = JSON.parse(await readFile(dashboardPath, 'utf-8'));
const kpis = JSON.parse(await readFile(kpiPath, 'utf-8'));

const jitter = (Math.sin(now.getUTCDate()) + 1) / 2;

dashboard.asOfUtc = now.toISOString();
dashboard.accountValue = Math.round(125000 + jitter * 2200);
dashboard.cash = Math.round(33000 + jitter * 1300);
dashboard.pnlDayPct = Number((0.4 + jitter * 1.4).toFixed(2));
dashboard.nextTradeEest = `${nextTrade.toISOString().slice(0, 10)} 09:30 EEST`;

kpis.asOfUtc = now.toISOString();
kpis.sharpeProxy = (1.2 + jitter * 0.3).toFixed(2);
kpis.winRatePct = `${Math.round(55 + jitter * 6)}%`;

await writeFile(dashboardPath, `${JSON.stringify(dashboard, null, 2)}\n`);
await writeFile(kpiPath, `${JSON.stringify(kpis, null, 2)}\n`);

console.log('Updated static demo data snapshots.');
