'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Container, Divider, Grid, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

type AppMode = 'demo' | 'real';
type TabKey = 'dashboard' | 'watchlist' | 'kpis' | 'learn';

type DashboardData = {
  asOfUtc: string;
  nextTradeEest: string;
  accountValue: number;
  cash: number;
  pnlDayPct: number;
  positionsCount: number;
  modeLabel: string;
  liveLabel: string;
};

type WatchIdea = {
  ticker: string;
  region: string;
  fairValueRange: string;
  marginOfSafety: string;
  positionSize: string;
  riskBand: 'Low' | 'Medium' | 'High';
};

type KpiData = {
  asOfUtc: string;
  cagrTargetPct: string;
  drawdownLimitPct: string;
  winRatePct: string;
  sharpeProxy: string;
  valueCoveragePct: string;
};

type LearnItem = {
  title: string;
  summary: string;
  action: string;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'kpis', label: 'KPIs' },
  { key: 'learn', label: 'Learn' }
];

const riskColorMap: Record<WatchIdea['riskBand'], 'success' | 'warning' | 'error'> = {
  Low: 'success',
  Medium: 'warning',
  High: 'error'
};

const baseCardSx = {
  borderRadius: 3,
  border: '1px solid #e2e8f0',
  boxShadow: '0 6px 24px rgba(15, 23, 42, 0.06)',
  backgroundColor: '#ffffff'
};

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const getBasePath = () => {
  const explicit = process.env.NEXT_PUBLIC_BASE_PATH;
  if (explicit) return explicit.startsWith('/') ? explicit : `/${explicit}`;
  if (typeof window === 'undefined') return '';

  const [firstSegment] = window.location.pathname.split('/').filter(Boolean);
  if (!firstSegment) return '';
  if (firstSegment.includes('.')) return '';
  return `/${firstSegment}`;
};

const getDataUrl = (path: string) => `${getBasePath()}${path.startsWith('/') ? path : `/${path}`}`;

export default function HomePage() {
  const [mode, setMode] = useState<AppMode>('demo');
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [watchlist, setWatchlist] = useState<WatchIdea[]>([]);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [learnItems, setLearnItems] = useState<LearnItem[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [dashboardRes, watchlistRes, kpiRes, learnRes] = await Promise.all([
        fetch(getDataUrl('/data/dashboard.json')),
        fetch(getDataUrl('/data/watchlist.json')),
        fetch(getDataUrl('/data/kpis.json')),
        fetch(getDataUrl('/data/learn.json'))
      ]);

      setDashboard((await dashboardRes.json()) as DashboardData);
      setWatchlist((await watchlistRes.json()) as WatchIdea[]);
      setKpis((await kpiRes.json()) as KpiData);
      setLearnItems((await learnRes.json()) as LearnItem[]);
    };

    void loadData();
  }, []);

  const modeChip = useMemo(
    () =>
      mode === 'demo'
        ? { label: 'Simulated / Demo Mode – hosted on free GitHub Pages / free tier', color: 'warning' as const }
        : { label: 'Real-time Live Data', color: 'success' as const },
    [mode]
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', py: 4 }}>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Card elevation={0} sx={baseCardSx}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="overline" sx={{ color: '#475569' }}>
                      Free Tier – Demo Mode
                    </Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ color: '#0f172a' }}>
                      Value-Driven Trading Advisor
                    </Typography>
                    <Typography sx={{ color: '#475569', mt: 0.5 }}>
                      Time now (UTC): {new Date().toISOString().replace('T', ' ').slice(0, 16)} • Next Trade: {dashboard?.nextTradeEest ?? '2026-04-15 09:30 EEST'}
                    </Typography>
                  </Box>
                  <Stack spacing={1} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                    <Chip color={modeChip.color} label={modeChip.label} />
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={mode}
                      onChange={(_, nextMode: AppMode | null) => {
                        if (nextMode) setMode(nextMode);
                      }}
                    >
                      <ToggleButton value="real">Real</ToggleButton>
                      <ToggleButton value="demo">Demo</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {tabs.map((tab) => (
                    <Button
                      key={tab.key}
                      variant={activeTab === tab.key ? 'contained' : 'text'}
                      onClick={() => setActiveTab(tab.key)}
                      sx={{ textTransform: 'none', borderRadius: 99 }}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {activeTab === 'dashboard' && dashboard ? (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Card elevation={0} sx={baseCardSx}>
                  <CardContent>
                    <Typography color="text.secondary">Account Value</Typography>
                    <Typography variant="h5" fontWeight={700}>{formatUsd(dashboard.accountValue)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card elevation={0} sx={baseCardSx}>
                  <CardContent>
                    <Typography color="text.secondary">Cash</Typography>
                    <Typography variant="h5" fontWeight={700}>{formatUsd(dashboard.cash)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card elevation={0} sx={baseCardSx}>
                  <CardContent>
                    <Typography color="text.secondary">Day P&L</Typography>
                    <Typography variant="h5" fontWeight={700}>{dashboard.pnlDayPct.toFixed(2)}%</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card elevation={0} sx={baseCardSx}>
                  <CardContent>
                    <Typography color="text.secondary">Open Positions</Typography>
                    <Typography variant="h5" fontWeight={700}>{dashboard.positionsCount}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : null}

          {activeTab === 'watchlist' ? (
            <Card elevation={0} sx={baseCardSx}>
              <CardContent>
                <Stack spacing={1.2}>
                  {watchlist.map((idea) => (
                    <Box key={idea.ticker} sx={{ p: 1.2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography fontWeight={700}>{idea.ticker} • {idea.region}</Typography>
                          <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Fair value: {idea.fairValueRange} • Margin of safety: {idea.marginOfSafety}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Position size: {idea.positionSize}
                          </Typography>
                        </Box>
                        <Chip label={`${idea.riskBand} risk`} color={riskColorMap[idea.riskBand]} />
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === 'kpis' && kpis ? (
            <Card elevation={0} sx={baseCardSx}>
              <CardContent>
                <Typography variant="h6" fontWeight={700}>KPI Panel ({mode.toUpperCase()})</Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>Timestamp UTC: {kpis.asOfUtc}</Typography>
                <Divider sx={{ my: 1.5 }} />
                <Grid container spacing={1.5}>
                  {Object.entries({
                    'CAGR Target': kpis.cagrTargetPct,
                    'Drawdown Limit': kpis.drawdownLimitPct,
                    'Win Rate': kpis.winRatePct,
                    'Sharpe Proxy': kpis.sharpeProxy,
                    'Value Coverage': kpis.valueCoveragePct
                  }).map(([label, value]) => (
                    <Grid item xs={12} sm={6} md={4} key={label}>
                      <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 1.2 }}>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>{label}</Typography>
                        <Typography variant="h6" fontWeight={700}>{value}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === 'learn' ? (
            <Card elevation={0} sx={baseCardSx}>
              <CardContent>
                <Stack spacing={1.2}>
                  {learnItems.map((item) => (
                    <Box key={item.title} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 1.2 }}>
                      <Typography fontWeight={700}>{item.title}</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>{item.summary}</Typography>
                      <Typography variant="body2" sx={{ mt: 0.6 }}>{item.action}</Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
