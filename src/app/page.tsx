'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Fade,
  Grid,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';

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

type EngineSnapshot = {
  symbol: string;
  price: number;
  volume: number;
  rsi: number;
  ts: string;
};

type EngineState = {
  snapshots?: Record<string, EngineSnapshot>;
  status?: { running?: boolean; message?: string; stage?: string };
  portfolio?: {
    metrics?: {
      portfolioValue?: number;
      cash?: number;
      dayPnlPct?: number;
    };
    positions?: Record<string, unknown>;
  };
};

type ProcessEvent = {
  type?: string;
  source?: string;
  symbol?: string;
  price?: number;
  rsi?: number;
  action?: string;
  size_pct?: number;
  reason?: string;
  timestamp?: string;
  errors?: string | null;
};

type DetailItem = {
  id: string;
  title: string;
  category: 'request' | 'result' | 'decision' | 'system';
  timestamp: string;
  symbol: string;
  stockName: string;
  summary: string;
  details: string;
  outcome?: string;
};

type UiState = 'idle' | 'started' | 'active' | 'completed';

const steps = [
  { label: 'Fetching', helper: '1. Fetching Yahoo market data...' },
  { label: 'Analyzing', helper: '2. Analyzing trend and RSI state...' },
  { label: 'Deciding', helper: '3. Planning LLM decision...' },
  { label: 'Executing', helper: '4. Executing simulated trade...' }
];

const stockNames: Record<string, string> = {
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corporation',
  NVDA: 'NVIDIA Corporation',
  AMZN: 'Amazon.com, Inc.',
  GOOGL: 'Alphabet Inc.',
  TSLA: 'Tesla, Inc.',
  META: 'Meta Platforms, Inc.'
};

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.4';

const roundedCardSx = {
  borderRadius: '12px',
  border: '1px solid rgba(148,163,184,0.25)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  background: '#ffffff'
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
  if (!firstSegment || firstSegment.includes('.')) return '';
  return `/${firstSegment}`;
};

const getDataUrl = (path: string) => `${getBasePath()}${path.startsWith('/') ? path : `/${path}`}`;
const getApiBaseUrl = () => process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';
const getApiUrl = (path: string) => `${getApiBaseUrl()}${path}`;
const getWebSocketUrl = () => {
  const apiBase = getApiBaseUrl();
  if (apiBase) return `${apiBase.replace(/^http/i, 'ws')}/ws`;
  if (typeof window === 'undefined') return '';
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/ws`;
};

const classifyState = (rsi: number | undefined) => {
  if (typeof rsi !== 'number') return 'Neutral';
  if (rsi >= 70) return 'Overbought';
  if (rsi <= 30) return 'Oversold';
  if (rsi >= 55) return 'Bullish trend';
  if (rsi <= 45) return 'Bearish trend';
  return 'Sideways';
};

const getDecisionReason = (action: string, marketState: string) => {
  if (action === 'BUY') return `Buy because state is ${marketState} and setup favors recovery/upside.`;
  if (action === 'SELL') return `Sell because state is ${marketState} and risk reduction is preferred.`;
  return `Hold because state is ${marketState} and no strong edge is visible.`;
};

const polarToCartesian = (radius: number, index: number, total: number) => {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle)
  };
};

const toStockDisplay = (symbol?: string) => {
  if (!symbol) return { symbol: 'Unknown', full: 'Unknown Company' };
  return { symbol, full: stockNames[symbol] ?? `${symbol} Corporation` };
};

const getSignalLabel = (rsi?: number, action?: string) => {
  const normalizedAction = String(action ?? '').toUpperCase();
  if (normalizedAction === 'BUY') return 'Bought';
  if (normalizedAction === 'SELL') return 'Sold';
  if (typeof rsi === 'number' && rsi <= 35) return 'Potential Buy Zone';
  if (typeof rsi === 'number' && rsi >= 70) return 'Potential Sell Zone';
  return 'Hold / Watch';
};

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [uiState, setUiState] = useState<UiState>('idle');
  const [processMessage, setProcessMessage] = useState('Reset - Ready to Start');
  const [executionCount, setExecutionCount] = useState(0);
  const [details, setDetails] = useState<DetailItem[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<DetailItem | null>(null);
  const [lastSymbol, setLastSymbol] = useState<string>('AAPL');
  const [snapshots, setSnapshots] = useState<Record<string, EngineSnapshot>>({});
  const snapshotsRef = useRef<Record<string, EngineSnapshot>>({});
  const uiStateRef = useRef<UiState>('idle');
  const detailPaneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    snapshotsRef.current = snapshots;
    uiStateRef.current = uiState;
  }, [snapshots, uiState]);

  useEffect(() => {
    if (!detailPaneRef.current) return;
    detailPaneRef.current.scrollTop = detailPaneRef.current.scrollHeight;
  }, [details]);

  useEffect(() => {
    const loadDashboard = async () => {
      const dashboardRes = await fetch(getDataUrl('/data/dashboard.json'));
      setDashboard((await dashboardRes.json()) as DashboardData);
    };

    const hydrateFromBackend = async () => {
      try {
        const response = await fetch(getApiUrl('/api/state'));
        if (!response.ok) return;
        const state = (await response.json()) as EngineState;
        if (state.snapshots) setSnapshots(state.snapshots);
        setDashboard((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            asOfUtc: Object.values(state.snapshots ?? {})[0]?.ts ?? prev.asOfUtc,
            accountValue: state.portfolio?.metrics?.portfolioValue ?? prev.accountValue,
            cash: state.portfolio?.metrics?.cash ?? prev.cash,
            pnlDayPct: state.portfolio?.metrics?.dayPnlPct ?? prev.pnlDayPct,
            positionsCount: Object.keys(state.portfolio?.positions ?? {}).length || prev.positionsCount,
            liveLabel: 'Connected to backend engine'
          };
        });
      } catch {
        setProcessMessage('Backend unavailable. Demo mode remains active.');
      }
    };

    void loadDashboard().then(hydrateFromBackend);
  }, []);

  useEffect(() => {
    const appendDetail = (entry: Omit<DetailItem, 'id'>) => {
      setDetails((prev) => [...prev, { ...entry, id: `${entry.timestamp}-${Math.random()}` }].slice(-200));
    };

    const handleStateEvent = (payload: EngineState) => {
      const isRunning = Boolean(payload.status?.running);
      setRunning(isRunning);
      if (payload.status?.message) setProcessMessage(payload.status.message);
      if (payload.snapshots) setSnapshots(payload.snapshots);
      if (isRunning && uiStateRef.current === 'idle') setUiState('started');
      if (isRunning && payload.status?.stage && payload.status.stage !== 'START') setUiState('active');
    };

    const handleProcessEvent = (payload: ProcessEvent) => {
      if (!payload.type) return;
      const timestamp = payload.timestamp ?? new Date().toISOString();
      const stock = toStockDisplay(payload.symbol);
      if (payload.symbol) setLastSymbol(payload.symbol);

      if (payload.type === 'tick-started') {
        setUiState('started');
        setActiveStep(0);
        setProcessMessage('Running... preparing fetch cycle');
        appendDetail({
          category: 'system',
          title: 'Cycle started',
          symbol: stock.symbol,
          stockName: stock.full,
          timestamp,
          summary: `Cycle started for ${Array.isArray((payload as { symbols?: string[] }).symbols) ? (payload as { symbols?: string[] }).symbols?.join(', ') : stock.symbol}`,
          details: JSON.stringify(payload, null, 2)
        });
      }

      if (payload.type === 'symbol-fetch-started') {
        setUiState('active');
        setActiveStep(0);
        setProcessMessage(`Fetching ${stock.full} (${stock.symbol})...`);
        appendDetail({
          category: 'request',
          title: `Yahoo API Request • ${stock.symbol}`,
          symbol: stock.symbol,
          stockName: stock.full,
          timestamp,
          summary: 'GET quote chart request sent',
          details: JSON.stringify({
            method: 'GET',
            url: `https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}?range=1d&interval=5m`,
            payload: { range: '1d', interval: '5m' },
            event: payload
          }, null, 2)
        });
      }

      if (payload.type === 'symbol-fetched' || payload.type === 'symbol-fallback') {
        setUiState('active');
        setActiveStep(1);
        const state = classifyState(payload.rsi);
        setProcessMessage(`Analyzing ${stock.symbol}: ${state}`);
        appendDetail({
          category: 'result',
          title: `Yahoo API Result • ${stock.symbol}`,
          symbol: stock.symbol,
          stockName: stock.full,
          timestamp,
          summary: `Price ${payload.price ?? '-'} | RSI ${payload.rsi ?? '-'} | ${state}`,
          details: JSON.stringify({
            symbol: stock.symbol,
            stockName: stock.full,
            price: payload.price,
            rsi: payload.rsi,
            state,
            fallbackReason: payload.reason ?? null
          }, null, 2)
        });
      }

      if (payload.type === 'decision-made') {
        setUiState('active');
        setActiveStep(2);
        const snapshot = payload.symbol ? snapshotsRef.current[payload.symbol] : undefined;
        const state = classifyState(snapshot?.rsi);
        const action = String(payload.action ?? 'HOLD').toUpperCase();
        setProcessMessage(`Planning ${action} decision for ${stock.symbol}`);
        appendDetail({
          category: 'decision',
          title: `LLM Decision • ${stock.symbol}`,
          symbol: stock.symbol,
          stockName: stock.full,
          timestamp,
          summary: `${action} • ${state}`,
          outcome: action,
          details: JSON.stringify({
            prompt: `Given price=${snapshot?.price ?? payload.price}, volume=${snapshot?.volume ?? '-'}, RSI=${snapshot?.rsi ?? payload.rsi}, decide BUY/SELL/HOLD with reason.`,
            output: {
              action,
              size_pct: payload.size_pct,
              reason: payload.reason ?? getDecisionReason(action, state)
            },
            marketState: state
          }, null, 2)
        });
      }

      if (payload.type === 'trade-processed') {
        setUiState('active');
        setActiveStep(3);
        setProcessMessage(`Executing ${payload.action ?? 'HOLD'} for ${stock.symbol}`);
        appendDetail({
          category: 'system',
          title: `Trade Execution • ${stock.symbol}`,
          symbol: stock.symbol,
          stockName: stock.full,
          timestamp,
          summary: `${payload.action ?? 'HOLD'} @ ${payload.price ?? '-'} processed`,
          outcome: payload.action?.toUpperCase() ?? 'HOLD',
          details: JSON.stringify(payload, null, 2)
        });
      }

      if (payload.type === 'tick-finished') {
        setUiState('completed');
        setExecutionCount((prev) => {
          const next = prev + 1;
          setProcessMessage(`Cycle #${next} Done`);
          appendDetail({
            category: 'system',
            title: `Cycle #${next} Done`,
            symbol: stock.symbol,
            stockName: stock.full,
            timestamp,
            summary: payload.errors ? `Completed with errors: ${payload.errors}` : 'Completed successfully',
            details: JSON.stringify(payload, null, 2)
          });
          return next;
        });
      }
    };

    let stream: EventSource | null = null;
    let socket: WebSocket | null = null;
    let usingSseFallback = false;
    const queue: Array<{ channel?: string; data?: EngineState & ProcessEvent }> = [];
    let throttleTimer: ReturnType<typeof setInterval> | null = null;

    const startThrottle = () => {
      if (throttleTimer) return;
      throttleTimer = setInterval(() => {
        const next = queue.shift();
        if (!next) return;
        if (next.channel === 'state' && next.data) handleStateEvent(next.data);
        if (next.channel === 'process' && next.data) handleProcessEvent(next.data);
      }, 120);
    };

    const connectSseFallback = () => {
      if (usingSseFallback) return;
      usingSseFallback = true;
      stream = new EventSource(getApiUrl('/events'));
      stream.addEventListener('state', (event) => handleStateEvent(JSON.parse(event.data) as EngineState));
      stream.addEventListener('process', (event) => handleProcessEvent(JSON.parse(event.data) as ProcessEvent));
      stream.onerror = () => setProcessMessage('Realtime stream disconnected. Retrying...');
    };

    startThrottle();

    try {
      socket = new WebSocket(getWebSocketUrl());
      socket.onopen = () => setProcessMessage('Realtime stream connected (WebSocket).');
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as { channel?: string; data?: EngineState & ProcessEvent };
        queue.push(payload);
      };
      socket.onerror = () => connectSseFallback();
      socket.onclose = () => {
        if (!usingSseFallback) connectSseFallback();
      };
    } catch {
      connectSseFallback();
    }

    return () => {
      socket?.close();
      stream?.close();
      if (throttleTimer) clearInterval(throttleTimer);
    };
  }, []);

  const runPipeline = async () => {
    if (running) return;
    setUiState('started');
    setProcessMessage('Running... waiting for backend events');
    try {
      await fetch(getApiUrl('/api/process/start'), { method: 'POST' });
    } catch {
      setRunning(true);
      setUiState('active');
      for (let step = 0; step < steps.length; step += 1) {
        setActiveStep(step);
        setProcessMessage(steps[step].helper);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 550));
      }
      setUiState('completed');
      setExecutionCount((prev) => prev + 1);
      setRunning(false);
    }
  };

  const resetFlow = () => {
    setUiState('idle');
    setActiveStep(0);
    setProcessMessage('Reset - Ready to Start');
  };

  const progress = useMemo(() => {
    if (uiState === 'idle') return 0;
    if (uiState === 'completed') return 100;
    return ((activeStep + 1) / steps.length) * 100;
  }, [activeStep, uiState]);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progressLength = (progress / 100) * circumference;

  const statusLabel =
    uiState === 'idle'
      ? 'Reset - Ready to Start'
      : uiState === 'started'
        ? 'Running...'
        : uiState === 'completed'
          ? `Cycle #${executionCount} Done`
          : `${activeStep + 1}. ${steps[activeStep].label}`;
  const focusStock = toStockDisplay(lastSymbol);
  const focusSnapshot = snapshots[lastSymbol];
  const focusSignal = getSignalLabel(focusSnapshot?.rsi);

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 2, md: 4 }, background: '#f8fafc' }}>
      <Container maxWidth="xl">
        <Stack spacing={2}>
          <Card elevation={0} sx={{ ...roundedCardSx, p: { xs: 1, md: 2 } }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography variant="h4" fontWeight={700}>Transparent Trading Monitor</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Idle, started, active, completed—fully visible with real-time Yahoo and LLM flow.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
                    <Chip color="primary" label={`Executions: #${executionCount}`} sx={{ fontWeight: 700, borderRadius: '12px' }} />
                    <Button component={Link} href="/readme" variant="outlined" size="small" sx={{ borderRadius: '12px', textTransform: 'none' }}>
                      UI README Panel
                    </Button>
                    <Button component={Link} href="/user-guide" variant="outlined" size="small" sx={{ borderRadius: '12px', textTransform: 'none' }}>
                      User Guide
                    </Button>
                  </Stack>
                </Stack>

                <Grid container spacing={1.25}>
                  {[
                    ['Account Value', dashboard ? formatUsd(dashboard.accountValue) : '--'],
                    ['Cash', dashboard ? formatUsd(dashboard.cash) : '--'],
                    ['Open Positions', dashboard ? String(dashboard.positionsCount) : '--'],
                    ['As Of (UTC)', dashboard?.asOfUtc ?? '--']
                  ].map(([label, value]) => (
                    <Grid item xs={6} md={3} key={label}>
                      <Box sx={{ p: 1.5, borderRadius: '12px', border: '1px solid rgba(148,163,184,0.28)', background: '#f8fafc' }}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography fontWeight={700}>{value}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <Button
                    aria-label="Start Trading"
                    variant="contained"
                    onClick={() => void runPipeline()}
                    disabled={running}
                    sx={{ borderRadius: '12px', textTransform: 'none' }}
                  >
                    {running ? 'Running…' : 'Start Trading'}
                  </Button>
                  <Button
                    aria-label="Reset flow"
                    variant="outlined"
                    onClick={resetFlow}
                    sx={{ borderRadius: '12px', textTransform: 'none' }}
                  >
                    Reset
                  </Button>
                  <Chip label={statusLabel} color={uiState === 'completed' ? 'success' : uiState === 'idle' ? 'default' : 'info'} sx={{ borderRadius: '12px' }} />
                </Stack>
                <Alert severity={uiState === 'completed' ? 'success' : 'info'}>{processMessage}</Alert>
                <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                  <strong>What execution means:</strong> an execution is one completed trading action from the engine (BUY, SELL, or HOLD).
                  <br />
                  <strong>Bought/Sold</strong> appears when the model executes a trade. <strong>Potential Buy Zone</strong> means RSI is low (≤ 35) and could be a favorable entry setup.
                </Alert>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Card elevation={0} sx={roundedCardSx}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700}>Process Wheel</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Thin wheel with explicit reset, running, active-step, and completed states.
                  </Typography>
                  <Tooltip
                    arrow
                    placement="top-start"
                    title={
                      <Box sx={{ p: 0.5 }}>
                        <Typography variant="caption" fontWeight={700}>
                          {focusStock.full} ({focusStock.symbol}) Evaluation
                        </Typography>
                        <Typography variant="caption" display="block">Price: {focusSnapshot?.price ?? '--'}</Typography>
                        <Typography variant="caption" display="block">RSI: {focusSnapshot?.rsi ?? '--'} ({classifyState(focusSnapshot?.rsi)})</Typography>
                        <Typography variant="caption" display="block">Volume: {focusSnapshot?.volume ?? '--'}</Typography>
                        <Typography variant="caption" display="block">Signal: {focusSignal}</Typography>
                        <Typography variant="caption" display="block">Last update: {focusSnapshot?.ts ?? '--'}</Typography>
                      </Box>
                    }
                  >
                    <Box sx={{ mb: 1.25, p: 1.25, borderRadius: '12px', border: '1px solid rgba(148,163,184,0.35)', background: '#f8fafc' }}>
                      <Typography variant="caption" color="text.secondary">Company evaluation (hover for key metrics)</Typography>
                      <Typography variant="body2" fontWeight={700}>{focusStock.full} ({focusStock.symbol})</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Market state: {classifyState(focusSnapshot?.rsi)} • Signal: {focusSignal}
                      </Typography>
                    </Box>
                  </Tooltip>
                  <Box sx={{ maxWidth: 320, mx: 'auto', position: 'relative' }}>
                    <svg viewBox="0 0 100 100" width="100%" aria-label="Trading process wheel">
                      <circle cx="50" cy="50" r={radius} fill="none" stroke={uiState === 'idle' ? 'rgba(100,116,139,0.45)' : 'rgba(148,163,184,0.3)'} strokeWidth="2.5" />
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke={uiState === 'completed' ? '#16a34a' : '#2563eb'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                        strokeDasharray={`${progressLength} ${circumference}`}
                        style={{ transition: 'stroke-dasharray 300ms ease, stroke 300ms ease' }}
                      />
                      {steps.map((step, index) => {
                        const point = polarToCartesian(radius, index, steps.length);
                        const isActive = uiState !== 'idle' && index === activeStep;
                        const isComplete = uiState === 'completed' || index < activeStep;
                        const fill = isActive ? '#2563eb' : isComplete ? '#16a34a' : '#e2e8f0';
                        const textColor = isActive ? '#ffffff' : isComplete ? '#ffffff' : '#64748b';
                        return (
                          <g key={step.label}>
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="5.5"
                              fill={fill}
                              stroke="rgba(255,255,255,0.95)"
                              strokeWidth="0.8"
                              style={{ transition: 'fill 250ms ease' }}
                            />
                            <text x={point.x} y={point.y + 1.2} textAnchor="middle" fontSize="4" fontWeight="700" fill={textColor}>
                              {isComplete ? '✓' : index + 1}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                      <Fade in key={processMessage} timeout={280}>
                        <Box sx={{ textAlign: 'center', p: 1.3, borderRadius: '12px', background: 'rgba(255,255,255,0.94)', maxWidth: 170 }}>
                          <Typography variant="caption" color="text.secondary">Central Status</Typography>
                          <Typography fontWeight={700} sx={{ fontSize: 14 }}>{statusLabel}</Typography>
                          <Typography variant="caption" color="text.secondary">{processMessage}</Typography>
                        </Box>
                      </Fade>
                    </Box>
                  </Box>

                  <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                    {steps.map((step, index) => (
                      <Button
                        key={step.label}
                        fullWidth
                        variant="text"
                        sx={{
                          justifyContent: 'flex-start',
                          border: index === activeStep && uiState !== 'idle' ? '1px solid rgba(37,99,235,0.45)' : '1px solid rgba(148,163,184,0.4)',
                          borderRadius: '12px',
                          background: index === activeStep ? 'rgba(219,234,254,0.5)' : 'transparent',
                          textTransform: 'none'
                        }}
                        onClick={() => {
                          const existing = details.find((item) => item.summary.includes(step.label));
                          if (existing) setSelectedDetail(existing);
                        }}
                        aria-label={`Step ${index + 1} ${step.label}`}
                      >
                        <Typography variant="body2" fontWeight={600}>{index + 1}. {step.label}</Typography>
                      </Button>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={8}>
              <Card elevation={0} sx={roundedCardSx}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700}>Realtime Execution Log</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                    Click any row for full timestamped request/response/decision payload.
                  </Typography>
                  <Box
                    ref={detailPaneRef}
                    sx={{
                      border: '1px solid rgba(148,163,184,0.3)',
                      borderRadius: '12px',
                      maxHeight: { xs: 360, md: 600 },
                      overflow: 'auto',
                      p: 1,
                      background: '#f8fafc'
                    }}
                  >
                    <Stack spacing={0.75}>
                      {details.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No events yet. Start Trading.</Typography>
                      ) : details.map((item) => (
                        <Button
                          key={item.id}
                          variant="text"
                          onClick={() => setSelectedDetail(item)}
                          sx={{
                            textTransform: 'none',
                            p: 1,
                            borderRadius: '12px',
                            border: '1px solid rgba(148,163,184,0.3)',
                            background: '#ffffff',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            width: '100%'
                          }}
                          aria-label={`Open log detail ${item.title}`}
                        >
                          <Box textAlign="left">
                            <Typography variant="caption" color="text.secondary">{item.timestamp}</Typography>
                            <Typography variant="body2" fontWeight={700}>{item.title}</Typography>
                            <Tooltip
                              arrow
                              title={
                                <Box>
                                  <Typography variant="caption" fontWeight={700}>{item.stockName} ({item.symbol})</Typography>
                                  <Typography variant="caption" display="block">Price: {snapshots[item.symbol]?.price ?? '--'}</Typography>
                                  <Typography variant="caption" display="block">RSI: {snapshots[item.symbol]?.rsi ?? '--'} ({classifyState(snapshots[item.symbol]?.rsi)})</Typography>
                                  <Typography variant="caption" display="block">Volume: {snapshots[item.symbol]?.volume ?? '--'}</Typography>
                                  <Typography variant="caption" display="block">Signal: {getSignalLabel(snapshots[item.symbol]?.rsi, item.outcome)}</Typography>
                                </Box>
                              }
                            >
                              <Typography variant="body2" color="text.secondary">{item.stockName} ({item.symbol})</Typography>
                            </Tooltip>
                            <Typography variant="body2">{item.summary}</Typography>
                          </Box>
                          <Stack direction="column" spacing={0.5} alignItems="flex-end">
                            <Chip
                              size="small"
                              label={item.category}
                              color={item.category === 'request' ? 'info' : item.category === 'result' ? 'success' : item.category === 'decision' ? 'warning' : 'default'}
                              sx={{ borderRadius: '10px', ml: 1 }}
                            />
                            <Chip
                              size="small"
                              variant="outlined"
                              label={getSignalLabel(snapshots[item.symbol]?.rsi, item.outcome)}
                              color={item.outcome === 'BUY' ? 'success' : item.outcome === 'SELL' ? 'error' : 'default'}
                              sx={{ borderRadius: '10px', ml: 1 }}
                            />
                          </Stack>
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card elevation={0} sx={roundedCardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700}>At-a-glance lifecycle</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Reset/Idle: thin gray wheel and “Reset - Ready to Start”. Started: blue progress arc and “Running...”. Active: colored step with live central text.
                Completed: green checks and cycle completion badge.
              </Typography>
              <Typography variant="caption" sx={{ mt: 1.25, display: 'block', color: 'rgba(30,41,59,0.65)' }}>
                Platform version: v{appVersion}
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </Container>

      <Dialog
        open={Boolean(selectedDetail)}
        onClose={() => setSelectedDetail(null)}
        fullWidth
        maxWidth="md"
        aria-labelledby="detail-dialog-title"
      >
        <DialogTitle id="detail-dialog-title">{selectedDetail?.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography variant="body2"><strong>Timestamp:</strong> {selectedDetail?.timestamp}</Typography>
            <Typography variant="body2"><strong>Stock:</strong> {selectedDetail?.stockName} ({selectedDetail?.symbol})</Typography>
            {selectedDetail?.outcome ? <Typography variant="body2"><strong>Outcome:</strong> {selectedDetail.outcome}</Typography> : null}
            <Box sx={{ border: '1px solid rgba(148,163,184,0.35)', borderRadius: '12px', p: 1.25, background: '#f8fafc', maxHeight: 400, overflow: 'auto' }}>
              <Typography variant="body2" component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
                {selectedDetail?.details}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
