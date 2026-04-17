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
  Grid,
  LinearProgress,
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
  status?: { running?: boolean; message?: string };
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
  symbol?: string;
  price?: number;
  rsi?: number;
  action?: string;
  size_pct?: number;
  reason?: string;
  timestamp?: string;
};

type LogEntry = {
  id: string;
  kind: 'request' | 'result' | 'system';
  title: string;
  detail: string;
  timestamp: string;
};

type DecisionEntry = {
  id: string;
  symbol: string;
  action: string;
  state: string;
  reason: string;
  timestamp: string;
};

const steps = [
  { label: 'Fetch Data', helper: '1. Fetching Yahoo market data...' },
  { label: 'Analyze', helper: '2. Analyzing trend and RSI state...' },
  { label: 'Decide', helper: '3. Building LLM decision and rationale...' },
  { label: 'Execute', helper: '4. Simulating or executing trade...' }
];

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.4';

const glassCardSx = {
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.58)',
  boxShadow: '0 22px 50px rgba(52, 74, 125, 0.14)',
  background: 'linear-gradient(145deg, rgba(255,255,255,0.52), rgba(255,255,255,0.24))',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)'
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

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [processMessage, setProcessMessage] = useState('Ready. Start to stream requests, results, and decisions.');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [decisions, setDecisions] = useState<DecisionEntry[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, EngineSnapshot>>({});
  const snapshotsRef = useRef<Record<string, EngineSnapshot>>({});

  useEffect(() => {
    snapshotsRef.current = snapshots;
  }, [snapshots]);

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
    const appendLog = (entry: Omit<LogEntry, 'id'>) => {
      setLogs((prev) => [{ ...entry, id: `${entry.timestamp}-${Math.random()}` }, ...prev].slice(0, 12));
    };

    const appendDecision = (entry: Omit<DecisionEntry, 'id'>) => {
      setDecisions((prev) => [{ ...entry, id: `${entry.timestamp}-${Math.random()}` }, ...prev].slice(0, 8));
    };

    const handleStateEvent = (payload: EngineState) => {
      setRunning(Boolean(payload.status?.running));
      if (payload.status?.message) setProcessMessage(payload.status.message);
      if (payload.snapshots) setSnapshots(payload.snapshots);
    };

    const handleProcessEvent = (payload: ProcessEvent) => {
      if (!payload.type) return;
      const timestamp = payload.timestamp ?? new Date().toISOString();

      if (payload.type === 'tick-started') {
        setActiveStep(0);
        appendLog({
          kind: 'system',
          title: 'Cycle started',
          detail: 'Trading cycle started. Next: fetch Yahoo market data.',
          timestamp
        });
      }

      if (payload.type === 'symbol-fetch-started') {
        setActiveStep(0);
        appendLog({
          kind: 'request',
          title: `Yahoo request • ${payload.symbol ?? 'Unknown'}`,
          detail: `GET chart request initiated for symbol=${payload.symbol ?? '-'} at ${timestamp}.`,
          timestamp
        });
      }

      if (payload.type === 'symbol-fetched' || payload.type === 'symbol-fallback') {
        setActiveStep(1);
        const state = classifyState(payload.rsi);
        appendLog({
          kind: 'result',
          title: `Yahoo result • ${payload.symbol ?? 'Unknown'}`,
          detail: `Price=${payload.price ?? '-'}, RSI=${payload.rsi ?? '-'} (${state}).`,
          timestamp
        });
      }

      if (payload.type === 'decision-made') {
        setActiveStep(2);
        const snapshot = payload.symbol ? snapshotsRef.current[payload.symbol] : undefined;
        const state = classifyState(snapshot?.rsi);
        const action = String(payload.action ?? 'HOLD').toUpperCase();
        appendDecision({
          symbol: payload.symbol ?? 'Unknown',
          action,
          state,
          reason: payload.reason ?? getDecisionReason(action, state),
          timestamp
        });
      }

      if (payload.type === 'trade-processed' || payload.type === 'tick-finished') {
        setActiveStep(3);
      }

      const message = payload.symbol ? `${payload.type}: ${payload.symbol}` : payload.type;
      setProcessMessage(`Realtime event: ${message}`);
    };

    let stream: EventSource | null = null;
    let socket: WebSocket | null = null;
    let usingSseFallback = false;

    const connectSseFallback = () => {
      if (usingSseFallback) return;
      usingSseFallback = true;
      stream = new EventSource(getApiUrl('/events'));
      stream.addEventListener('state', (event) => handleStateEvent(JSON.parse(event.data) as EngineState));
      stream.addEventListener('process', (event) => handleProcessEvent(JSON.parse(event.data) as ProcessEvent));
      stream.onerror = () => setProcessMessage('Realtime stream disconnected. Retrying...');
    };

    try {
      socket = new WebSocket(getWebSocketUrl());
      socket.onopen = () => setProcessMessage('Realtime stream connected (WebSocket).');
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as { channel?: string; data?: EngineState & ProcessEvent };
        if (payload.channel === 'state' && payload.data) handleStateEvent(payload.data);
        if (payload.channel === 'process' && payload.data) handleProcessEvent(payload.data);
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
    };
  }, []);

  const runPipeline = async () => {
    if (running) return;
    setActiveStep(0);
    setProcessMessage('Manual run requested. Waiting for backend stream events...');
    try {
      await fetch(getApiUrl('/api/process/start'), { method: 'POST' });
    } catch {
      setRunning(true);
      for (let step = 0; step < steps.length; step += 1) {
        setActiveStep(step);
        setProcessMessage(steps[step].helper);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
      setRunning(false);
    }
  };

  const progress = useMemo(() => ((activeStep + 1) / steps.length) * 100, [activeStep]);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progressLength = (progress / 100) * circumference;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 2, md: 4 },
        background: 'radial-gradient(circle at top right, #f8f4ff 5%, #eef6ff 42%, #ebf8f7 100%)'
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={2.5}>
          <Card elevation={0} sx={{ ...glassCardSx, p: { xs: 1, md: 2 } }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h4" fontWeight={700}>Transparent Trading Monitor</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Simple view of requests, market states, LLM decisions, and execution flow in real time.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button component={Link} href="/readme" variant="outlined" size="small" sx={{ borderRadius: 99, textTransform: 'none' }}>
                      UI README Panel
                    </Button>
                    <Button component={Link} href="/user-guide" variant="outlined" size="small" sx={{ borderRadius: 99, textTransform: 'none' }}>
                      User Guide
                    </Button>
                  </Stack>
                </Stack>

                <Grid container spacing={2}>
                  {[
                    ['Account Value', dashboard ? formatUsd(dashboard.accountValue) : '--'],
                    ['Cash', dashboard ? formatUsd(dashboard.cash) : '--'],
                    ['Open Positions', dashboard ? String(dashboard.positionsCount) : '--'],
                    ['As Of (UTC)', dashboard?.asOfUtc ?? '--']
                  ].map(([label, value]) => (
                    <Grid item xs={6} md={3} key={label}>
                      <Tooltip title={`Summary metric: ${label}`}>
                        <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(255,255,255,0.58)', background: 'rgba(255,255,255,0.35)' }}>
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography fontWeight={700}>{value}</Typography>
                        </Box>
                      </Tooltip>
                    </Grid>
                  ))}
                </Grid>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ sm: 'center' }}>
                  <Tooltip title="Start a full trading cycle and stream every step.">
                    <span>
                      <Button variant="contained" onClick={() => void runPipeline()} disabled={running} sx={{ borderRadius: 99, textTransform: 'none' }}>
                        {running ? 'Running…' : 'Start Process'}
                      </Button>
                    </span>
                  </Tooltip>
                  <Chip color="info" label={`Current: ${steps[activeStep].label}`} />
                  <Chip variant="outlined" label={`Next: ${steps[Math.min(activeStep + 1, steps.length - 1)].label}`} />
                </Stack>
                <LinearProgress variant="determinate" value={progress} />
                <Alert severity="info">{processMessage}</Alert>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Card elevation={0} sx={glassCardSx}>
                <CardContent>
                  <Tooltip title="This wheel shows each process step and what comes next.">
                    <Typography variant="h6" fontWeight={700}>Process Wheel (4 steps)</Typography>
                  </Tooltip>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Active step is highlighted. The blue arc is a single progress line on the same circle path.
                  </Typography>
                  <Box sx={{ maxWidth: 320, mx: 'auto', position: 'relative' }}>
                    <svg viewBox="0 0 100 100" width="100%" aria-label="Trading process wheel">
                      <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="3" />
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3"
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                        strokeDasharray={`${progressLength} ${circumference}`}
                      />
                      {steps.map((step, index) => {
                        const point = polarToCartesian(radius, index, steps.length);
                        const isActive = index === activeStep;
                        const isComplete = index < activeStep;
                        const fill = isActive ? '#16a34a' : isComplete ? '#94a3b8' : '#e2e8f0';
                        const textColor = isActive ? '#ffffff' : isComplete ? '#334155' : '#64748b';
                        return (
                          <g key={step.label}>
                            <circle cx={point.x} cy={point.y} r="5.8" fill={fill} stroke="rgba(255,255,255,0.9)" strokeWidth="0.8" />
                            <text x={point.x} y={point.y + 1.2} textAnchor="middle" fontSize="4" fontWeight="700" fill={textColor}>
                              {index + 1}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                      <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 99, background: 'rgba(255,255,255,0.7)' }}>
                        <Typography variant="caption" color="text.secondary">Active phase</Typography>
                        <Typography fontWeight={700}>{activeStep + 1} / {steps.length}</Typography>
                        <Typography variant="caption" color="text.secondary">{steps[activeStep].label}</Typography>
                      </Box>
                    </Box>
                  </Box>
                  <Stack spacing={0.75} sx={{ mt: 1.25 }}>
                    {steps.map((step, index) => (
                      <Box key={step.label} sx={{ p: 1, borderRadius: 2, border: index === activeStep ? '1px solid rgba(22,163,74,0.4)' : '1px solid rgba(148,163,184,0.4)', background: index === activeStep ? 'rgba(220,252,231,0.7)' : 'rgba(255,255,255,0.2)' }}>
                        <Typography variant="caption" color="text.secondary">Step {index + 1}</Typography>
                        <Typography variant="body2" fontWeight={600}>{step.helper}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card elevation={0} sx={glassCardSx}>
                <CardContent>
                  <Tooltip title="Raw stream of Yahoo requests, responses, and system updates.">
                    <Typography variant="h6" fontWeight={700}>Realtime Logs</Typography>
                  </Tooltip>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                    Request payloads, timestamps, and response snippets appear here without page reloads.
                  </Typography>
                  <Stack spacing={1}>
                    {logs.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No events yet. Click Start Process.</Typography>
                    ) : logs.map((log) => (
                      <Box key={log.id} sx={{ p: 1, borderRadius: 2, border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.25)' }}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                          <Typography variant="caption" fontWeight={700}>{log.title}</Typography>
                          <Chip
                            size="small"
                            label={log.kind}
                            color={log.kind === 'request' ? 'info' : log.kind === 'result' ? 'success' : 'default'}
                          />
                        </Stack>
                        <Typography variant="body2">{log.detail}</Typography>
                        <Typography variant="caption" color="text.secondary">{log.timestamp}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card elevation={0} sx={glassCardSx}>
                <CardContent>
                  <Tooltip title="Plain-language LLM decisions with visible market state.">
                    <Typography variant="h6" fontWeight={700}>Decision Transparency</Typography>
                  </Tooltip>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                    Every decision includes action, detected stock state, and an easy-to-read reason.
                  </Typography>
                  <Stack spacing={1}>
                    {decisions.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No decisions yet.</Typography>
                    ) : decisions.map((entry) => (
                      <Box key={entry.id} sx={{ p: 1, borderRadius: 2, border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.25)' }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography fontWeight={700}>{entry.action} {entry.symbol}</Typography>
                          <Chip
                            size="small"
                            label={entry.state}
                            color={entry.state.includes('Bullish') || entry.state === 'Oversold' ? 'success' : entry.state.includes('Bearish') || entry.state === 'Overbought' ? 'warning' : 'default'}
                          />
                        </Stack>
                        <Typography variant="body2">{entry.reason}</Typography>
                        <Typography variant="caption" color="text.secondary">{entry.timestamp}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card elevation={0} sx={glassCardSx}>
            <CardContent>
              <Tooltip title="High-level explanation of how this app works.">
                <Typography variant="h6" fontWeight={700}>How this app works (README-style panel)</Typography>
              </Tooltip>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                1) Stream Yahoo requests and results. 2) Translate market data into plain-language state labels.
                3) Produce LLM decision with reason. 4) Execute/simulate and show the next expected step.
              </Typography>
              <Typography variant="caption" sx={{ mt: 1.25, display: 'block', color: 'rgba(30,41,59,0.65)' }}>
                Platform version: v{appVersion}
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
