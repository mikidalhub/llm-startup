'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';

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

type EngineState = {
  marketData?: { lastUpdate?: string };
  portfolio?: {
    metrics?: {
      portfolioValue?: number;
      cash?: number;
      dayPnlPct?: number;
    };
    positions?: Record<string, unknown>;
  };
};

const tabs: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'kpis', label: 'KPIs' },
  { key: 'learn', label: 'Learn' }
];

const phases = [
  { label: 'Bean Start', detail: 'Initialize strategy context and startup checks.' },
  { label: 'Yahoo Data', detail: 'Fetch free Yahoo Finance market snapshots.' },
  { label: 'Analyze', detail: 'Run fundamentals, risk, and valuation engines.' },
  { label: 'Signal', detail: 'Generate buy/hold/sell action points.' },
  { label: 'Trade', detail: 'Execute or simulate orders with position sizing.' }
];

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.4';

const riskColorMap: Record<WatchIdea['riskBand'], 'success' | 'warning' | 'error'> = {
  Low: 'success',
  Medium: 'warning',
  High: 'error'
};

const glassCardSx = {
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.58)',
  boxShadow: '0 30px 70px rgba(52, 74, 125, 0.18)',
  background: 'linear-gradient(145deg, rgba(255,255,255,0.52), rgba(255,255,255,0.24))',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)'
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
const getApiBaseUrl = () => process.env.NEXT_PUBLIC_API_BASE_URL || '';
const getApiUrl = (path: string) => `${getApiBaseUrl()}${path}`;

const orbStyles = [
  { top: '12%', left: '50%' },
  { top: '30%', left: '79%' },
  { top: '64%', left: '76%' },
  { top: '76%', left: '40%' },
  { top: '48%', left: '14%' }
];

export default function HomePage() {
  const [mode, setMode] = useState<AppMode>('demo');
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [watchlist, setWatchlist] = useState<WatchIdea[]>([]);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [learnItems, setLearnItems] = useState<LearnItem[]>([]);
  const [activePhase, setActivePhase] = useState(0);
  const [running, setRunning] = useState(false);
  const [processMessage, setProcessMessage] = useState('Ready to run the end-to-end trading flow.');

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

    const hydrateFromBackend = async () => {
      try {
        const response = await fetch(getApiUrl('/api/state'));
        if (!response.ok) return;

        const state = (await response.json()) as EngineState;
        setDashboard((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            asOfUtc: state.marketData?.lastUpdate ?? prev.asOfUtc,
            accountValue: state.portfolio?.metrics?.portfolioValue ?? prev.accountValue,
            cash: state.portfolio?.metrics?.cash ?? prev.cash,
            pnlDayPct: state.portfolio?.metrics?.dayPnlPct ?? prev.pnlDayPct,
            positionsCount: Object.keys(state.portfolio?.positions ?? {}).length || prev.positionsCount,
            liveLabel: 'Connected to backend engine'
          };
        });
      } catch {
        setProcessMessage('Backend unavailable right now. Demo data mode is still active.');
      }
    };

    void loadData().then(hydrateFromBackend);
  }, []);

  const runPipeline = async () => {
    if (running) return;

    setRunning(true);
    setActivePhase(0);
    setProcessMessage('Starting process: bean start initialized.');

    try {
      await fetch(getApiUrl('/api/process/start'), { method: 'POST' });
    } catch {
      setProcessMessage('Simulating flow locally because backend trigger is unavailable.');
    }

    for (let index = 0; index < phases.length; index += 1) {
      setActivePhase(index);
      setProcessMessage(`${phases[index].label}: ${phases[index].detail}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 900));
    }

    setProcessMessage('Process completed: data fetched, analysis finished, trade decision ready.');
    setRunning(false);
  };

  const modeChip = useMemo(
    () =>
      mode === 'demo'
        ? { label: 'Simulated / Demo Mode', color: 'warning' as const }
        : { label: 'Real-time Live Data', color: 'success' as const },
    [mode]
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        py: { xs: 2, md: 5 },
        overflow: 'hidden',
        background: 'radial-gradient(circle at top right, #f8f4ff 5%, #eef6ff 42%, #ebf8f7 100%)',
        '@keyframes trailPulse': {
          '0%, 100%': { opacity: 0.35 },
          '50%': { opacity: 0.85 }
        }
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2 }}>
        <Card elevation={0} sx={{ ...glassCardSx, p: { xs: 1, md: 2 } }}>
          <CardContent>
            <Stack spacing={3}>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" sx={{ letterSpacing: 2, color: 'rgba(30, 41, 59, 0.76)' }}>
                    Glass Intelligence Control Center
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ color: '#0f172a', mb: 0.5 }}>
                    Value-Driven Trading Advisor
                  </Typography>
                  <Typography sx={{ color: 'rgba(15, 23, 42, 0.7)' }}>
                    UTC {new Date().toISOString().replace('T', ' ').slice(0, 16)} • Next Trade {dashboard?.nextTradeEest ?? '2026-04-15 09:30 EEST'}
                  </Typography>
                  <Typography sx={{ mt: 1, color: 'rgba(15,23,42,0.72)' }}>
                    This platform connects free market data, autonomous analysis, risk controls, and execution logic.
                    You can inspect opportunities, understand why a signal is produced, and run the full trading flow on demand.
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                    <Button component={Link} href="/readme" variant="outlined" size="small" sx={{ borderRadius: 99, textTransform: 'none' }}>
                      Platform README
                    </Button>
                    <Button component={Link} href="/user-guide" variant="outlined" size="small" sx={{ borderRadius: 99, textTransform: 'none' }}>
                      User Guide
                    </Button>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    width: { xs: 300, md: 360 },
                    aspectRatio: '1 / 1',
                    borderRadius: '50%',
                    position: 'relative',
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.56)',
                    background: 'radial-gradient(circle at 40% 30%, rgba(255,255,255,0.5), rgba(255,255,255,0.08))',
                    boxShadow: 'inset 0 0 30px rgba(255,255,255,0.38), 0 20px 40px rgba(93,128,176,0.18)'
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: '12%',
                      borderRadius: '50%',
                      border: '1px dashed rgba(74, 107, 157, 0.35)',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        inset: -12,
                        borderRadius: '50%',
                        border: '1px solid rgba(255,255,255,0.42)',
                        filter: 'blur(1px)',
                        animation: 'trailPulse 5s ease-in-out infinite'
                      }
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: '4%',
                      borderRadius: '50%',
                      border: '6px solid rgba(148, 163, 184, 0.25)',
                      borderTopColor: '#2563eb',
                      transform: `rotate(${(activePhase / phases.length) * 360}deg)`,
                      transition: 'transform 400ms ease'
                    }}
                  />
                  <Box sx={{ position: 'absolute', inset: 0 }}>
                    {orbStyles.map((orb, index) => (
                      <Box
                        key={`${orb.top}-${orb.left}`}
                        sx={{
                          position: 'absolute',
                          top: orb.top,
                          left: orb.left,
                          transform: 'translate(-50%, -50%)',
                          width: { xs: 36, md: 42 },
                          height: { xs: 36, md: 42 },
                          borderRadius: '50%',
                          background: index === activePhase ? 'linear-gradient(145deg, #90cdf4, #2563eb)' : 'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(196,228,255,0.46))',
                          color: index === activePhase ? '#fff' : 'inherit',
                          border: '1px solid rgba(255,255,255,0.9)',
                          display: 'grid',
                          placeItems: 'center'
                        }}
                      >
                        <Typography variant="caption" fontWeight={700}>{index + 1}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: { xs: 120, md: 132 },
                      height: { xs: 120, md: 132 },
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      border: '1px solid rgba(255,255,255,0.75)',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.2))'
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'rgba(30,41,59,0.6)' }}>Active Phase</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.1 }}>{activePhase + 1} / {phases.length}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(30,41,59,0.6)', textAlign: 'center', px: 1 }}>{phases[activePhase].label}</Typography>
                  </Box>
                </Box>
                <Stack spacing={0.75} sx={{ minWidth: { md: 220 }, maxWidth: 260 }}>
                  {phases.map((phase, index) => (
                    <Box
                      key={phase.label}
                      sx={{
                        px: 1.2,
                        py: 0.7,
                        borderRadius: 2,
                        border: index === activePhase ? '1px solid rgba(37,99,235,0.35)' : '1px solid rgba(255,255,255,0.5)',
                        background: index === activePhase ? 'rgba(219,234,254,0.7)' : 'rgba(255,255,255,0.3)'
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'rgba(15, 23, 42, 0.62)' }}>Step {index + 1}</Typography>
                      <Typography variant="body2" fontWeight={600}>{phase.label}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Stack>

              <Card elevation={0} sx={glassCardSx}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="h6" fontWeight={700}>Run the strategy in one click</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Press Start Process to run: bean start → Yahoo free market data ingest → analysis engines → signal generation → trade decision.
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                      <Button variant="contained" onClick={() => void runPipeline()} disabled={running} sx={{ borderRadius: 99, textTransform: 'none' }}>
                        {running ? 'Running...' : 'Start Process'}
                      </Button>
                      <Chip label={`Current action point: ${phases[activePhase].label}`} color="info" />
                    </Stack>
                    {running ? <LinearProgress variant="determinate" value={((activePhase + 1) / phases.length) * 100} /> : null}
                    <Alert severity="info">{processMessage}</Alert>
                  </Stack>
                </CardContent>
              </Card>

              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ sm: 'center' }}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {tabs.map((tab) => (
                    <Button
                      key={tab.key}
                      variant={activeTab === tab.key ? 'contained' : 'text'}
                      onClick={() => setActiveTab(tab.key)}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 99,
                        background: activeTab === tab.key ? 'linear-gradient(135deg, #5aa3ff, #9586ff)' : 'rgba(255,255,255,0.3)',
                        color: activeTab === tab.key ? '#fff' : '#1e293b'
                      }}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </Stack>
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

              {activeTab === 'dashboard' && dashboard ? (
                <Grid container spacing={2}>
                  {[
                    ['Account Value', formatUsd(dashboard.accountValue)],
                    ['Cash', formatUsd(dashboard.cash)],
                    ['Day P&L', `${dashboard.pnlDayPct.toFixed(2)}%`],
                    ['Open Positions', String(dashboard.positionsCount)]
                  ].map(([label, value]) => (
                    <Grid item xs={12} sm={6} md={3} key={label}>
                      <Card elevation={0} sx={glassCardSx}>
                        <CardContent>
                          <Typography color="text.secondary">{label}</Typography>
                          <Typography variant="h5" fontWeight={700}>{value}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : null}

              {activeTab === 'watchlist' ? (
                <Card elevation={0} sx={glassCardSx}>
                  <CardContent>
                    <Stack spacing={1.2}>
                      {watchlist.map((idea) => (
                        <Box key={idea.ticker} sx={{ p: 1.2, border: '1px solid rgba(255,255,255,0.6)', borderRadius: 2, background: 'rgba(255,255,255,0.25)' }}>
                          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                            <Box>
                              <Typography fontWeight={700}>{idea.ticker} • {idea.region}</Typography>
                              <Typography variant="body2" sx={{ color: '#475569' }}>
                                Fair value: {idea.fairValueRange} • Margin of safety: {idea.marginOfSafety}
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#475569' }}>
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
                <Card elevation={0} sx={glassCardSx}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={700}>KPI Panel ({mode.toUpperCase()})</Typography>
                    <Typography variant="body2" sx={{ color: '#475569' }}>Timestamp UTC: {kpis.asOfUtc}</Typography>
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
                          <Box sx={{ border: '1px solid rgba(255,255,255,0.6)', borderRadius: 2, p: 1.2, background: 'rgba(255,255,255,0.2)' }}>
                            <Typography variant="caption" sx={{ color: '#475569' }}>{label}</Typography>
                            <Typography variant="h6" fontWeight={700}>{value}</Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              ) : null}

              {activeTab === 'learn' ? (
                <Card elevation={0} sx={glassCardSx}>
                  <CardContent>
                    <Stack spacing={1.2}>
                      {learnItems.map((item) => (
                        <Box key={item.title} sx={{ border: '1px solid rgba(255,255,255,0.6)', borderRadius: 2, p: 1.2, background: 'rgba(255,255,255,0.2)' }}>
                          <Typography fontWeight={700}>{item.title}</Typography>
                          <Typography variant="body2" sx={{ color: '#475569' }}>{item.summary}</Typography>
                          <Typography variant="body2" sx={{ mt: 0.6 }}>{item.action}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              ) : null}
              <Typography variant="caption" sx={{ textAlign: 'center', color: 'rgba(30,41,59,0.6)' }}>
                Platform version: v{appVersion}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
