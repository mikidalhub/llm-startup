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

const orbStyles = [
  { top: '10%', left: '50%', delay: '0s' },
  { top: '26%', left: '77%', delay: '-2.4s' },
  { top: '60%', left: '78%', delay: '-4.8s' },
  { top: '78%', left: '48%', delay: '-7.2s' },
  { top: '58%', left: '20%', delay: '-9.6s' }
];

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
        '@keyframes spinWheel': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' }
        },
        '@keyframes trailPulse': {
          '0%, 100%': { opacity: 0.35 },
          '50%': { opacity: 0.85 }
        }
      }}
    >
      {[
        'radial-gradient(circle at 30% 20%, rgba(151, 201, 255, 0.55), rgba(151, 201, 255, 0))',
        'radial-gradient(circle at 70% 30%, rgba(255, 182, 216, 0.48), rgba(255, 182, 216, 0))',
        'radial-gradient(circle at 50% 75%, rgba(180, 255, 233, 0.52), rgba(180, 255, 233, 0))'
      ].map((gradient, index) => (
        <Box
          key={gradient}
          sx={{
            position: 'absolute',
            width: { xs: 280, md: 520 },
            height: { xs: 280, md: 520 },
            borderRadius: '50%',
            filter: 'blur(7px)',
            opacity: 0.85,
            background: gradient,
            top: index === 0 ? -90 : index === 1 ? 60 : 'auto',
            bottom: index === 2 ? -110 : 'auto',
            left: index === 0 ? -70 : index === 2 ? '15%' : 'auto',
            right: index === 1 ? -90 : 'auto',
            pointerEvents: 'none'
          }}
        />
      ))}

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
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    {['◌', '⌁', '◍'].map((icon) => (
                      <Box
                        key={icon}
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 17,
                          border: '1px solid rgba(255,255,255,0.65)',
                          color: 'rgba(30,41,59,0.7)',
                          background: 'rgba(255,255,255,0.34)',
                          backdropFilter: 'blur(8px)'
                        }}
                      >
                        {icon}
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Box
                  sx={{
                    width: { xs: 280, md: 340 },
                    height: { xs: 280, md: 340 },
                    borderRadius: '50%',
                    position: 'relative',
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
                  <Box sx={{ position: 'absolute', inset: 0, animation: 'spinWheel 12s linear infinite' }}>
                    {orbStyles.map((orb, index) => (
                      <Box
                        key={`${orb.top}-${orb.left}`}
                        sx={{
                          position: 'absolute',
                          top: orb.top,
                          left: orb.left,
                          transform: 'translate(-50%, -50%)',
                          width: { xs: 30, md: 36 },
                          height: { xs: 30, md: 36 },
                          borderRadius: '50%',
                          background: 'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(196,228,255,0.46))',
                          border: '1px solid rgba(255,255,255,0.9)',
                          backdropFilter: 'blur(12px)',
                          boxShadow: '0 0 18px rgba(181, 223, 255, 0.7), inset 0 0 10px rgba(255,255,255,0.8)',
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: 52,
                            height: 8,
                            transform: 'translate(-50%, -50%)',
                            borderRadius: 99,
                            background: 'linear-gradient(90deg, rgba(173,217,255,0), rgba(173,217,255,0.45), rgba(173,217,255,0))',
                            filter: 'blur(2px)',
                            animation: `trailPulse 2.2s ease-in-out infinite`,
                            animationDelay: orb.delay
                          }
                        }}
                      >
                        <Typography variant="caption" sx={{ position: 'absolute', top: '115%', left: '50%', transform: 'translateX(-50%)', color: 'rgba(30,41,59,0.62)' }}>
                          {index + 1}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: { xs: 108, md: 126 },
                      height: { xs: 108, md: 126 },
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      border: '1px solid rgba(255,255,255,0.75)',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.2))',
                      backdropFilter: 'blur(16px)',
                      boxShadow: 'inset 0 5px 18px rgba(255,255,255,0.55), 0 12px 22px rgba(70,102,145,0.2)'
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'rgba(30,41,59,0.6)' }}>Live Processing</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.1 }}>{dashboard?.positionsCount ?? 0} / 5</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(30,41,59,0.6)' }}>{dashboard?.liveLabel ?? 'Bootstrapping feed'}</Typography>
                  </Box>
                </Box>
              </Stack>

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
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
