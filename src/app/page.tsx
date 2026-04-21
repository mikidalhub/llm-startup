'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
  alpha
} from '@mui/material';
import { keyframes } from '@mui/system';

type EngineState = {
  snapshots?: Record<string, { symbol: string; price: number; rsi: number; ts: string }>;
  status?: { stage?: string; running?: boolean; message?: string; lastRunAt?: string | null };
  portfolio?: {
    metrics?: {
      portfolioValue?: number;
      pnl?: number;
      sharpe?: number;
      winRate?: number;
      maxDrawdown?: number;
      avgProfitPerTrade?: number;
    };
    positions?: Record<string, { shares: number; avgCost: number }>;
    equityCurve?: Array<{ ts: string; value: number }>;
  };
  llmCost?: {
    session?: { calls?: number; totalTokens?: number; estimatedUsd?: number };
    byStrategy?: Record<string, { calls?: number; totalTokens?: number; estimatedUsd?: number }>;
  };
  lastError?: string | null;
};

type ProcessEvent = {
  timestamp?: string;
  type?: string;
  node?: string;
  status?: 'START' | 'PROCESSING' | 'DONE' | string;
  payload?: Record<string, unknown>;
  symbol?: string;
  price?: number;
  rsi?: number;
  action?: string;
  size_pct?: number;
  reason?: string;
  errors?: string | null;
};

type Trade = { ts?: string; symbol: string; action: string; price: number; reason?: string; status?: string; shares?: number };
type Decision = { id?: number | string; ts?: string; symbol?: string; action?: string; sizePct?: number; reason?: string; source?: string; trade?: Trade | null };
type OperationResult = { id: string; ts?: string; symbol: string; action: string; status?: string; signedValue?: number; grossValue?: number; shares?: number; price?: number };
type ResultsPayload = {
  trades?: Trade[];
  signals?: Array<{ timestamp?: string; symbol: string; signal: string; rsi: number; price: number }>;
  operationResults?: OperationResult[];
  cumulativeRevenue?: number;
};
type WorkflowStep = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  behindScenes: string;
  dataHint: string;
  status: string;
};
type StockSummary = { symbol: string; currentPrice?: number | null; name?: string };
type HomeDashboardCache = {
  state: EngineState;
  results: ResultsPayload;
  decisions: Decision[];
  events: ProcessEvent[];
  stocks: StockSummary[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';
const HOME_SESSION_KEY = 'home-dashboard-cache-v1';
let homeDashboardCache: HomeDashboardCache | null = null;
const formatUsd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
const formatPct = (value: number) => `${(value || 0).toFixed(2)}%`;

const metricHelp: Record<string, string> = {
  sharpe: 'Risk-adjusted return. Higher usually means better efficiency.',
  maxDrawdown: 'Largest peak-to-trough decline in equity.',
  winRate: 'Percent of filled non-HOLD trades currently positive in this simulation.',
  avgProfitPerTrade: 'Average signed value per filled non-HOLD trade.'
};

export default function HomePage() {
  const [engineState, setEngineState] = useState<EngineState>({});
  const [results, setResults] = useState<ResultsPayload>({ trades: [], signals: [] });
  const [events, setEvents] = useState<ProcessEvent[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [isTriggering, setIsTriggering] = useState(false);
  const [llmStreamText, setLlmStreamText] = useState('');
  const [tradeLimit, setTradeLimit] = useState(6);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [uiMode, setUiMode] = useState<'light' | 'dark'>('dark');
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [isSseConnected, setIsSseConnected] = useState(false);
  const hasHydratedFromCache = useRef(false);

  useEffect(() => {
    const fromMemoryCache = homeDashboardCache;
    if (fromMemoryCache) {
      setEngineState(fromMemoryCache.state);
      setResults(fromMemoryCache.results);
      setDecisions(fromMemoryCache.decisions);
      setEvents(fromMemoryCache.events);
      setStocks(fromMemoryCache.stocks);
      hasHydratedFromCache.current = true;
    } else if (typeof window !== 'undefined') {
      try {
        const serialized = window.sessionStorage.getItem(HOME_SESSION_KEY);
        if (serialized) {
          const parsed = JSON.parse(serialized) as HomeDashboardCache;
          if (parsed?.state) {
            homeDashboardCache = parsed;
            setEngineState(parsed.state);
            setResults(parsed.results);
            setDecisions(parsed.decisions);
            setEvents(parsed.events);
            setStocks(parsed.stocks);
            hasHydratedFromCache.current = true;
          }
        }
      } catch {
        // ignore malformed cache
      }
    }

    const hydrate = async (force = false) => {
      if (!force && hasHydratedFromCache.current) return;
      try {
        const bootstrapRes = await fetch(`${API_BASE}/api/bootstrap`);
        if (bootstrapRes.ok) {
          const bootstrap = await bootstrapRes.json();
          const nextState = bootstrap.state || {};
          const nextResults = bootstrap.results || { trades: [], signals: [] };
          const nextDecisions = bootstrap.decisions || [];
          const nextEvents = bootstrap.events || [];
          setEngineState(nextState);
          setResults(nextResults);
          setDecisions(nextDecisions);
          setEvents(nextEvents);
          const stocksRes = await fetch(`${API_BASE}/api/stocks`);
          let nextStocks: StockSummary[] = [];
          if (stocksRes.ok) {
            const stockPayload = await stocksRes.json();
            nextStocks = (stockPayload?.details || []).slice(0, 7);
            setStocks(nextStocks);
          }
          const cachedPayload = {
            state: nextState,
            results: nextResults,
            decisions: nextDecisions,
            events: nextEvents,
            stocks: nextStocks
          };
          homeDashboardCache = cachedPayload;
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(HOME_SESSION_KEY, JSON.stringify(cachedPayload));
          }
          hasHydratedFromCache.current = true;
          return;
        }
      } catch {
        // offline preview
      }
    };

    void hydrate(!hasHydratedFromCache.current);

    if (typeof window !== 'undefined') {
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let reconnectAttempt = 0;
      let stream: EventSource | null = null;
      let isUnmounted = false;

      const scheduleReconnect = () => {
        if (isUnmounted) return;
        const maxDelayMs = 48_000;
        const delayMs = Math.min(3_000 * (2 ** reconnectAttempt), maxDelayMs);
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(() => {
          connectStream();
        }, delayMs);
        console.warn(`[SSE] connection lost. Reconnecting in ${delayMs}ms (attempt ${reconnectAttempt}).`);
      };

      const connectStream = () => {
        if (isUnmounted) return;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        stream = new EventSource(`${API_BASE}/events`);
        stream.addEventListener('open', () => {
          reconnectAttempt = 0;
          setIsSseConnected(true);
        });
        stream.addEventListener('state', (raw) => {
          try {
            const nextState = JSON.parse((raw as MessageEvent).data) as EngineState;
            setEngineState(nextState);
            if (homeDashboardCache) {
              homeDashboardCache = { ...homeDashboardCache, state: nextState };
              window.sessionStorage.setItem(HOME_SESSION_KEY, JSON.stringify(homeDashboardCache));
            }
          } catch {
            // ignore malformed event
          }
        });
        stream.addEventListener('process', (raw) => {
          try {
            const parsed = JSON.parse((raw as MessageEvent).data) as ProcessEvent;
            setEvents((prev) => {
              const next = [...prev, parsed].slice(-220);
              if (homeDashboardCache) {
                homeDashboardCache = { ...homeDashboardCache, events: next };
                window.sessionStorage.setItem(HOME_SESSION_KEY, JSON.stringify(homeDashboardCache));
              }
              return next;
            });
            if (parsed.type === 'LLM_STREAM') {
              const token = String((parsed.payload?.token as string) || '');
              if (token) {
                setLlmStreamText((prev) => `${prev}${token}`.slice(-1500));
              }
            }
          } catch {
            // ignore malformed event
          }
        });
        stream.addEventListener('error', () => {
          setIsSseConnected(false);
          stream?.close();
          scheduleReconnect();
        });
      };

      connectStream();

      return () => {
        isUnmounted = true;
        setIsSseConnected(false);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        stream?.close();
      };
    }

    return undefined;
  }, []);

  const metrics = engineState.portfolio?.metrics || {};
  const equityCurve = engineState.portfolio?.equityCurve || [];
  const now = new Date();
  const todayIso = new Date().toISOString().slice(0, 10);
  const isDark = uiMode === 'dark';
  const canvasBg = isDark ? '#030508' : '#eef2f7';
  const canvasText = isDark ? '#e2e8f0' : '#0f172a';
  const trades = useMemo(() => {
    const source = results.trades || [];
    const filtered = filterDate ? source.filter((trade) => (trade.ts || '').startsWith(filterDate)) : source;
    return filtered.slice(-16).reverse();
  }, [filterDate, results.trades]);
  const topStocks = useMemo(() => stocks.slice(0, 7), [stocks]);
  const dailyChange = equityCurve.length > 1 ? equityCurve.at(-1)!.value - equityCurve.at(-2)!.value : 0;
  const netProfit = metrics.pnl || 0;
  const revenue = useMemo(() => {
    if (typeof results.cumulativeRevenue === 'number') return results.cumulativeRevenue;
    return (results.trades || [])
      .filter((trade) => trade.status === 'FILLED')
      .reduce((sum, trade) => sum + ((trade.action === 'SELL' ? 1 : -1) * ((trade.shares || 0) * trade.price)), 0);
  }, [results.cumulativeRevenue, results.trades]);

  const selectedDecision = useMemo(() => {
    if (!selectedTrade) return null;
    return [...decisions].reverse().find((decision) => decision.symbol === selectedTrade.symbol && decision.action === selectedTrade.action) || null;
  }, [decisions, selectedTrade]);

  const similarSituations = useMemo(() => {
    if (!selectedTrade) return [];
    return (results.trades || [])
      .filter((trade) => trade.symbol === selectedTrade.symbol && trade.action === selectedTrade.action)
      .slice(-4);
  }, [results.trades, selectedTrade]);

  const graphNodes = ['DATA', 'TECHNICAL_AGENT', 'FUNDAMENTAL_AGENT', 'SENTIMENT_AGENT', 'AGGREGATOR', 'RISK', 'EXECUTION'] as const;
  const graphStatus = useMemo(() => {
    const statusMap = Object.fromEntries(graphNodes.map((node) => [node, 'idle'])) as Record<string, string>;
    for (const event of events) {
      if (!event.node) continue;
      statusMap[event.node] = event.status?.toLowerCase?.() || 'done';
    }
    return statusMap;
  }, [events]);
  const latestRiskEvent = useMemo(
    () => [...events].reverse().find((item) => ['RISK_APPROVED', 'RISK_REJECTED', 'RISK_MODIFIED'].includes(String(item.type))),
    [events]
  );
  const latestExecutionEvent = useMemo(
    () => [...events].reverse().find((item) => item.type === 'EXECUTION_RESULT'),
    [events]
  );
  const activePhase = useMemo(() => graphNodes.find((node) => ['processing', 'start'].includes(graphStatus[node])) || 'IDLE', [graphNodes, graphStatus]);
  const activeWorkflowStepId = useMemo(() => workflowStatusToActiveId(graphNodes, graphStatus), [graphNodes, graphStatus]);
  const workflowSteps = useMemo(
    () =>
      graphNodes.map((node) => ({
        id: node,
        title: node.replace('_', ' '),
        subtitle:
          node === 'DATA' ? 'Collecting market snapshots' :
            node === 'AGGREGATOR' ? 'Combining multi-agent reasoning' :
              node === 'EXECUTION' ? 'Sending or simulating orders' : 'Evaluating this phase',
        description:
          node === 'DATA' ? 'The system fetches latest prices, indicators, and internal state for the decision cycle.' :
            node === 'TECHNICAL_AGENT' ? 'Technical agent evaluates trends, momentum, and chart signals.' :
              node === 'FUNDAMENTAL_AGENT' ? 'Fundamental agent checks business quality, valuation, and profitability context.' :
                node === 'SENTIMENT_AGENT' ? 'Sentiment agent reads qualitative signals from commentary and narrative.' :
                  node === 'AGGREGATOR' ? 'The LLM aggregator reconciles all opinions into one proposed trade action.' :
                    node === 'RISK' ? 'Risk module validates guardrails, exposure limits, and allowed sizing.' :
                      'Execution node records and applies the final approved action.',
        behindScenes:
          node === 'AGGREGATOR' ? 'Streaming tokens are generated and normalized into a structured decision payload.' :
            node === 'RISK' ? 'Rule engine can approve, reject, or modify the action before it reaches execution.' :
              'Each step emits process events used by the live dashboard and event history.',
        dataHint:
          node === 'AGGREGATOR' ? (llmStreamText.slice(-180) || 'Awaiting reasoning tokens from LLM stream.') :
            node === 'RISK' ? String((latestRiskEvent?.payload?.reason as string) || latestRiskEvent?.type || 'No recent risk event.') :
              node === 'EXECUTION' ? String((latestExecutionEvent?.payload?.status as string) || 'No recent execution payload.') :
                `Current state: ${graphStatus[node] || 'idle'}`,
        status: graphStatus[node] || 'idle'
      })),
    [graphNodes, graphStatus, latestExecutionEvent?.payload?.status, latestRiskEvent?.payload?.reason, latestRiskEvent?.type, llmStreamText]
  );

  const triggerManualRun = async () => {
    setIsTriggering(true);
    try {
      await fetch(`${API_BASE}/api/process/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'MANUAL_UI' })
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: canvasBg, color: canvasText, p: 2.4, transition: 'all 0.25s ease' }}>
      <Stack spacing={1.8} sx={{ mr: { md: '360px', xs: 0 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontSize: 11, letterSpacing: '0.22em', color: isDark ? '#7c8ca3' : '#475569' }}>AI MULTI-AGENT TRADING</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" variant="outlined" onClick={() => setUiMode((prev) => (prev === 'light' ? 'dark' : 'light'))}>
              {uiMode === 'light' ? 'Dark mode' : 'Light mode'}
            </Button>
            <LiveProcessingIndicator isLive={Boolean(engineState.status?.running)} />
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
          <GlassPanel sx={{ maxWidth: { md: 240 } }}>
            <Typography sx={{ fontSize: 11, color: '#8da0bb' }}>Current date</Typography>
            <DateBadge date={now} />
            <Typography sx={{ fontSize: 11, color: '#64748b' }}>Daily schedule: 9:00 AM</Typography>
          </GlassPanel>
          <MetricCard title="Portfolio Value" value={formatUsd(metrics.portfolioValue || 0)} subtitle="Live equity" />
          <MetricCard title="Net Profit" value={formatUsd(netProfit)} subtitle="After costs" positive={netProfit >= 0} />
          <MetricCard title="Daily Change" value={formatUsd(dailyChange)} subtitle="Last step delta" positive={dailyChange >= 0} />
          <MetricCard title="Revenue" value={formatUsd(revenue)} subtitle="From actions" positive={revenue >= 0} />
        </Stack>

        <GlassPanel>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ md: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#8da0bb' }}>Data loading strategy</Typography>
              <Typography sx={{ fontSize: 12, color: '#cbd5e1' }}>
                One bootstrap fetch hydrates the page, then Server-Sent Events push all live updates in real time.
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.8}>
              <Tooltip title="Single source of truth for live updates.">
                <Chip size="small" label="SSE only" sx={{ ...badgeSx, cursor: 'help' }} />
              </Tooltip>
              <Tooltip title={isSseConnected ? 'Connected to live event stream.' : 'Offline or reconnecting to event stream.'}>
                <Chip size="small" label={isSseConnected ? 'Live stream online' : 'Live stream offline'} sx={{ ...badgeSx, cursor: 'help' }} />
              </Tooltip>
            </Stack>
          </Stack>
          <Typography sx={{ mt: 0.8, fontSize: 11, color: '#64748b' }}>
            Trading cadence: once per day (scheduled by backend) or manually with the Run trading now button.
          </Typography>
        </GlassPanel>

        <GlassPanel>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} justifyContent='space-between'>
            <Stack direction='row' spacing={1} alignItems='center'>
              <Button variant='contained' size='small' disabled={isTriggering} onClick={() => void triggerManualRun()}>
                {isTriggering ? 'Starting...' : 'Run trading now'}
              </Button>
              <Typography sx={{ fontSize: 12, color: '#8da0bb' }}>Filter by date</Typography>
              <input type='date' value={filterDate} max={todayIso} onChange={(event) => setFilterDate(event.target.value)} style={{ background: '#0f172a', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 6, padding: '4px 8px' }} />
              <Button size='small' onClick={() => setFilterDate('')}>Clear</Button>
            </Stack>
            <Typography sx={{ fontSize: 12, color: '#64748b' }}>Loaded items: {trades.length} trades · {events.length} logs · Active phase: {activePhase}</Typography>
          </Stack>
        </GlassPanel>

        <TradingPipelineGraph
          graphStatus={graphStatus}
          llmStreamText={llmStreamText}
          latestRiskEvent={latestRiskEvent}
          latestExecutionEvent={latestExecutionEvent}
          steps={workflowSteps}
          activeStepId={activeWorkflowStepId}
          onStepClick={setSelectedStep}
        />

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2}>
          <GlassPanel sx={{ flex: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 12, color: '#8da0bb' }}>Recent trades</Typography>
              <Button href="/trades" size="small">View full history</Button>
            </Stack>
            <Stack spacing={0.7}>
              {trades.slice(0, tradeLimit).map((trade, index) => (
                <Box
                  key={`${trade.ts || index}-${trade.symbol}`}
                  onClick={() => setSelectedTrade(trade)}
                  sx={{
                    p: 1,
                    borderRadius: 1.6,
                    cursor: 'pointer',
                    border: `1px solid ${alpha(trade.action === 'BUY' ? '#22c55e' : '#f97316', 0.35)}`,
                    bgcolor: alpha('#0b1220', 0.55)
                  }}
                >
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontSize: 12.5 }}>{trade.symbol} · {trade.action}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: trade.action === 'BUY' ? '#86efac' : '#fdba74' }}>{formatUsd(trade.price)}</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 11, color: '#8da0bb' }}>{trade.reason || 'No reason provided'}</Typography>
                </Box>
              ))}
              {!trades.length ? <Typography sx={{ fontSize: 12, color: '#64748b' }}>No trades yet.</Typography> : null}
              {tradeLimit < trades.length ? <Button size="small" onClick={() => setTradeLimit((prev) => prev + 6)}>Load more</Button> : null}
            </Stack>
          </GlassPanel>

          <GlassPanel sx={{ flex: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 12, color: '#8da0bb' }}>Tracked stocks (max 7)</Typography>
              <Typography sx={{ fontSize: 11, color: '#64748b' }}>Next to recent trades</Typography>
            </Stack>
            <Stack spacing={0.7}>
              {topStocks.map((stock) => (
                <Button
                  key={stock.symbol}
                  component={Link}
                  href={`/stocks?symbol=${stock.symbol}`}
                  variant="text"
                  sx={{ justifyContent: 'space-between', border: '1px solid rgba(148,163,184,0.22)', borderRadius: 1.2, px: 1.2, py: 0.7 }}
                >
                  <Typography sx={{ fontSize: 12.5, color: '#cbd5e1' }}>{stock.symbol}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#86efac' }}>{formatUsd(stock.currentPrice || 0)}</Typography>
                </Button>
              ))}
              {!topStocks.length ? <Typography sx={{ fontSize: 12, color: '#64748b' }}>No stocks loaded yet.</Typography> : null}
            </Stack>
          </GlassPanel>
        </Stack>

        <GlassPanel>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 12, color: '#8da0bb' }}>Core metrics</Typography>
            <Stack direction="row" spacing={0.8}>
              {(['sharpe', 'maxDrawdown', 'winRate', 'avgProfitPerTrade'] as const).map((key) => (
                <Tooltip key={key} title={metricHelp[key]}>
                  <Chip
                    size="small"
                    label={`${key === 'avgProfitPerTrade' ? 'avg/trade' : key}: ${key.includes('Rate') || key.includes('Drawdown') ? formatPct(Number(metrics[key] || 0)) : key === 'avgProfitPerTrade' ? formatUsd(Number(metrics[key] || 0)) : Number(metrics[key] || 0).toFixed(2)}`}
                    sx={{ borderRadius: 1.4, bgcolor: alpha('#0f172a', 0.68), color: '#cbd5e1' }}
                  />
                </Tooltip>
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.8} flexWrap="wrap">
            <Chip size="small" label="timeline history" sx={badgeSx} />
            <Chip size="small" label="memory badge" sx={badgeSx} />
            <Chip size="small" label="stored insights" sx={badgeSx} />
            <Chip size="small" label={`LLM calls: ${engineState.llmCost?.session?.calls || 0}`} sx={badgeSx} />
            <Chip size="small" label={`Tokens: ${engineState.llmCost?.session?.totalTokens || 0}`} sx={badgeSx} />
            <Chip size="small" label={`Est cost: ${formatUsd(engineState.llmCost?.session?.estimatedUsd || 0)}`} sx={badgeSx} />
            <Chip size="small" label={engineState.lastError ? 'risk: guarded' : 'risk: normal'} sx={badgeSx} />
          </Stack>
        </GlassPanel>

        <Box
          onClick={() => setShowTimeline((v) => !v)}
          sx={{ p: 1, borderRadius: 1.6, bgcolor: alpha('#0b1220', 0.55), border: '1px solid rgba(148,163,184,0.18)', cursor: 'pointer' }}
        >
          <Typography sx={{ fontSize: 12, color: '#8da0bb' }}>Learning timeline · {(results.trades || []).length} outcomes</Typography>
        </Box>

        <Collapse in={showTimeline}>
          <GlassPanel sx={{ maxHeight: 220, overflowY: 'auto' }}>
            {(results.trades || []).slice(-20).reverse().map((trade, index) => (
              <Stack key={`${trade.ts || index}-${trade.symbol}`} direction="row" justifyContent="space-between" sx={{ py: 0.6 }}>
                <Typography sx={{ fontSize: 12.3 }}>{trade.symbol} · {trade.action}</Typography>
                <Typography sx={{ fontSize: 12.3, color: trade.action === 'BUY' ? '#86efac' : '#fdba74' }}>{trade.ts ? new Date(trade.ts).toLocaleString() : 'n/a'}</Typography>
              </Stack>
            ))}
          </GlassPanel>
        </Collapse>
      </Stack>

      <Drawer
        anchor="right"
        open
        variant="persistent"
        PaperProps={{
          sx: {
            width: 340,
            bgcolor: isDark ? alpha('#050911', 0.88) : alpha('#f8fafc', 0.96),
            color: isDark ? '#e2e8f0' : '#0f172a',
            p: 2,
            borderLeft: '1px solid rgba(148,163,184,0.16)',
            backdropFilter: 'blur(14px) saturate(120%)'
          }
        }}
      >
        <Typography sx={{ fontSize: 11, letterSpacing: '0.16em', color: '#64748b' }}>DECISION DETAIL</Typography>
        <Typography sx={{ fontSize: 20, fontWeight: 300, mt: 0.4 }}>{selectedTrade ? `${selectedTrade.symbol} · ${selectedTrade.action}` : 'Select a trade'}</Typography>
        <Typography sx={{ fontSize: 12.5, color: '#9fb1c8', mt: 1 }}>{selectedTrade?.reason || 'Click any recent trade to inspect reasoning.'}</Typography>

        <Divider sx={{ my: 1.6, borderColor: 'rgba(148,163,184,0.15)' }} />
        <Typography sx={{ fontSize: 12, color: '#8da0bb', mb: 0.6 }}>Reasoning summary</Typography>
        <Row label="Confidence" value={selectedDecision ? `${Math.max(56, Math.round((selectedDecision.sizePct || 0.04) * 1000))}%` : '—'} />
        <Row label="Key factor" value={selectedDecision?.reason || selectedTrade?.reason || 'Momentum + risk gates'} />
        <Row label="Memory impact" value={similarSituations.length ? `Used ${similarSituations.length} similar outcomes` : 'No similar memory hit'} />

        <Button size="small" sx={{ mt: 1, borderRadius: 1.2 }} onClick={() => setShowPipeline((v) => !v)}>
          {showPipeline ? 'Hide full pipeline' : 'Show full pipeline'}
        </Button>

        <Collapse in={showPipeline}>
          <Stack spacing={0.8} sx={{ mt: 1 }}>
            {graphNodes.map((step) => (
              <Box
                key={step}
                sx={{
                  p: 1,
                  borderRadius: 1.4,
                  bgcolor: alpha('#0f172a', graphStatus[step] === 'processing' ? 0.85 : 0.55),
                  border: `1px solid ${graphStatus[step] === 'processing' ? 'rgba(34,197,94,0.55)' : 'rgba(148,163,184,0.15)'}`
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ fontSize: 12.5 }}>{step}</Typography>
                  <Typography sx={{ fontSize: 11, color: '#8da0bb' }}>{graphStatus[step]}</Typography>
                </Stack>
                <LinearProgress
                  sx={{ mt: 0.8, borderRadius: 1, bgcolor: 'rgba(30,41,59,0.6)' }}
                  variant="determinate"
                  value={graphStatus[step] === 'done' ? 100 : graphStatus[step] === 'processing' ? 66 : graphStatus[step] === 'start' ? 32 : 8}
                />
              </Box>
            ))}
          </Stack>
        </Collapse>

        <Divider sx={{ my: 1.6, borderColor: 'rgba(148,163,184,0.15)' }} />
        <Typography sx={{ fontSize: 12, color: '#8da0bb', mb: 0.6 }}>LLM streaming panel</Typography>
        <Box sx={{ p: 1, borderRadius: 1.2, bgcolor: alpha('#0f172a', 0.56), maxHeight: 110, overflowY: 'auto' }}>
          <Typography sx={{ fontSize: 11.5, color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{llmStreamText || 'No tokens streamed yet (fallback or idle).'}</Typography>
        </Box>

        <Divider sx={{ my: 1.6, borderColor: 'rgba(148,163,184,0.15)' }} />
        <Typography sx={{ fontSize: 12, color: '#8da0bb', mb: 0.6 }}>Decision + risk panel</Typography>
        <Row label="Risk result" value={String(latestRiskEvent?.type || 'n/a')} />
        <Row label="Risk note" value={String((latestRiskEvent?.payload?.risk_reason as string) || (latestRiskEvent?.payload?.reason as string) || 'No override.')} />
        <Row label="Final action" value={String((latestRiskEvent?.payload?.action as string) || selectedTrade?.action || 'HOLD')} />

        <Divider sx={{ my: 1.6, borderColor: 'rgba(148,163,184,0.15)' }} />
        <Typography sx={{ fontSize: 12, color: '#8da0bb', mb: 0.6 }}>Execution log</Typography>
        <Box sx={{ p: 1, borderRadius: 1.2, bgcolor: alpha('#0f172a', 0.56), maxHeight: 110, overflowY: 'auto' }}>
          <Typography sx={{ fontSize: 11.5, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{latestExecutionEvent ? JSON.stringify(latestExecutionEvent.payload || {}, null, 2) : 'No execution event yet.'}</Typography>
        </Box>

        <Divider sx={{ my: 1.6, borderColor: 'rgba(148,163,184,0.15)' }} />
        <Typography sx={{ fontSize: 12, color: '#8da0bb', mb: 0.6 }}>Live states</Typography>
        <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>
          Visual transitions are rendered directly on workflow nodes and animated edges to avoid log-centric UI clutter.
        </Typography>

        {selectedDecision?.id ? (
          <Button href={`/decisions?id=${selectedDecision.id}`} size="small" sx={{ mt: 1.4, borderRadius: 1.2 }}>
            Open decision page
          </Button>
        ) : null}
      </Drawer>
      <Dialog open={Boolean(selectedStep)} onClose={() => setSelectedStep(null)} fullWidth maxWidth="sm">
        <DialogTitle>{selectedStep?.title || 'Workflow step'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.1, color: '#334155' }}>{selectedStep?.description}</Typography>
          <Typography sx={{ fontSize: 13, mb: 1 }}><strong>Behind the scenes:</strong> {selectedStep?.behindScenes}</Typography>
          <Typography sx={{ fontSize: 13 }}><strong>Live data:</strong> {selectedStep?.dataHint}</Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function MetricCard({ title, value, subtitle, positive }: { title: string; value: string; subtitle: string; positive?: boolean }) {
  return (
    <GlassPanel sx={{ flex: 1 }}>
      <Typography sx={{ fontSize: 11.5, color: '#8da0bb' }}>{title}</Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 300, color: positive == null ? '#e2e8f0' : positive ? '#86efac' : '#fca5a5' }}>{value}</Typography>
      <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>{subtitle}</Typography>
    </GlassPanel>
  );
}

const pulseDot = keyframes`
  0% { transform: scale(0.9); opacity: 0.5; }
  50% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.5; }
`;

const flowAnim = keyframes`
  0% { background-position: 0 0; opacity: 0.45; }
  50% { opacity: 1; }
  100% { background-position: 160px 0; opacity: 0.45; }
`;

const thinkAnim = keyframes`
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
`;

function LiveProcessingIndicator({ isLive }: { isLive: boolean }) {
  return (
    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ px: 1, py: 0.5, borderRadius: 1.2, border: `1px solid ${alpha('#ef4444', 0.45)}`, bgcolor: alpha('#450a0a', 0.26) }}>
      <Typography sx={{ fontSize: 11, letterSpacing: '0.08em', color: '#fca5a5' }}>LIVE PROCESSING</Typography>
      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#ef4444', boxShadow: '0 0 14px rgba(239,68,68,0.75)', animation: `${pulseDot} 1.3s ease-in-out infinite`, opacity: isLive ? 1 : 0.45 }} />
    </Stack>
  );
}

function TradingPipelineGraph({
  graphStatus,
  llmStreamText,
  latestRiskEvent,
  latestExecutionEvent,
  steps,
  activeStepId,
  onStepClick
}: {
  graphStatus: Record<string, string>;
  llmStreamText: string;
  latestRiskEvent: ProcessEvent | undefined;
  latestExecutionEvent: ProcessEvent | undefined;
  steps: WorkflowStep[];
  activeStepId: string | null;
  onStepClick: (step: WorkflowStep) => void;
}) {
  const nodeTone: Record<string, string> = {
    DATA: '#38bdf8',
    TECHNICAL_AGENT: '#22c55e',
    FUNDAMENTAL_AGENT: '#f59e0b',
    SENTIMENT_AGENT: '#d946ef',
    AGGREGATOR: '#60a5fa',
    RISK: '#fb7185',
    EXECUTION: '#22d3ee'
  };

  const nodeState = (node: string) => graphStatus[node] || 'idle';
  const getStepById = (id: string) => steps.find((step) => step.id === id);
  const isActive = (node: string) => ['start', 'processing'].includes(nodeState(node));
  const isDone = (node: string) => nodeState(node) === 'done';
  const isAnyActive = (nodes: string[]) => nodes.some((node) => isActive(node));
  const isAnyDone = (nodes: string[]) => nodes.some((node) => isDone(node));
  const flowState = (nodes: string[]) => (isAnyActive(nodes) ? 'active' : isAnyDone(nodes) ? 'done' : 'idle');

  return (
    <GlassPanel sx={{ p: 1.6 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 1.2 }}>
        <Typography sx={{ fontSize: 12, color: '#8da0bb' }}>Real-time AI decision workflow</Typography>
        <Stack direction="row" spacing={0.8}>
          <Chip size="small" label={`Active phase: ${activeStepId || 'IDLE'}`} sx={badgeSx} />
          <Chip size="small" label="SSE event-driven" sx={badgeSx} />
        </Stack>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '200px 28px 1fr 28px 240px 28px 170px 28px 170px' }, gap: 1, alignItems: 'center' }}>
        <PipelineNode title="DATA COLLECTION" subtitle="Fetching market data..." state={nodeState('DATA')} tone={nodeTone.DATA} onClick={() => { const step = getStepById('DATA'); if (step) onStepClick(step); }} />
        <PipelineConnector state={flowState(['DATA', 'TECHNICAL_AGENT', 'FUNDAMENTAL_AGENT', 'SENTIMENT_AGENT'])} />
        <Box sx={{ display: 'grid', gap: 0.8, p: 0.8, border: '1px solid rgba(148,163,184,0.16)', borderRadius: 1.6, bgcolor: alpha('#020617', 0.35) }}>
          <Typography sx={{ fontSize: 10.5, letterSpacing: '0.08em', color: '#8da0bb' }}>PARALLEL AGENTS</Typography>
          <PipelineNode title="TECHNICAL ANALYSIS" subtitle="Analyzing charts..." state={nodeState('TECHNICAL_AGENT')} tone={nodeTone.TECHNICAL_AGENT} compact onClick={() => { const step = getStepById('TECHNICAL_AGENT'); if (step) onStepClick(step); }} />
          <PipelineNode title="FUNDAMENTAL ANALYSIS" subtitle="Evaluating reports..." state={nodeState('FUNDAMENTAL_AGENT')} tone={nodeTone.FUNDAMENTAL_AGENT} compact onClick={() => { const step = getStepById('FUNDAMENTAL_AGENT'); if (step) onStepClick(step); }} />
          <PipelineNode title="SENTIMENT ANALYSIS" subtitle="Assessing news..." state={nodeState('SENTIMENT_AGENT')} tone={nodeTone.SENTIMENT_AGENT} compact onClick={() => { const step = getStepById('SENTIMENT_AGENT'); if (step) onStepClick(step); }} />
        </Box>
        <PipelineConnector state={flowState(['TECHNICAL_AGENT', 'FUNDAMENTAL_AGENT', 'SENTIMENT_AGENT', 'AGGREGATOR'])} />
        <PipelineNode title="LLM AGGREGATOR" subtitle="Generating decision..." state={nodeState('AGGREGATOR')} tone={nodeTone.AGGREGATOR} focus extra={llmStreamText ? llmStreamText.slice(-110) : 'thinking…'} onClick={() => { const step = getStepById('AGGREGATOR'); if (step) onStepClick(step); }} />
        <PipelineConnector state={flowState(['AGGREGATOR', 'RISK'])} />
        <PipelineNode title="RISK" subtitle="Checking limits..." state={nodeState('RISK')} tone={nodeTone.RISK} extra={String(latestRiskEvent?.type || 'awaiting')} onClick={() => { const step = getStepById('RISK'); if (step) onStepClick(step); }} />
        <PipelineConnector state={flowState(['RISK', 'EXECUTION'])} />
        <PipelineNode title="EXECUTION" subtitle="Executing order..." state={nodeState('EXECUTION')} tone={nodeTone.EXECUTION} extra={latestExecutionEvent ? 'trade sent' : 'queueing'} onClick={() => { const step = getStepById('EXECUTION'); if (step) onStepClick(step); }} />
      </Box>

      <Stack direction="row" spacing={0.8} sx={{ mt: 1.2, overflowX: 'auto' }}>
        {['DATA', 'TECHNICAL_AGENT', 'FUNDAMENTAL_AGENT', 'SENTIMENT_AGENT', 'AGGREGATOR', 'RISK', 'EXECUTION'].map((node) => (
          <Box
            key={`flow-${node}`}
            sx={{
              height: 5,
              minWidth: 112,
              borderRadius: 2,
              bgcolor: node === activeStepId ? alpha(nodeTone[node], 0.72) : alpha('#64748b', 0.18),
              backgroundImage: `linear-gradient(90deg, transparent 0%, ${alpha('#e2e8f0', 0.85)} 50%, transparent 100%)`,
              backgroundSize: '160px 100%',
              animation: isActive(node) && node === activeStepId ? `${flowAnim} 1.2s linear infinite` : 'none'
            }}
          />
        ))}
      </Stack>

      <Typography sx={{ fontSize: 11.5, color: '#8da0bb' }}>
        Clear handoff lines map each step from data ingestion to execution for easier operational tracing.
      </Typography>
    </GlassPanel>
  );
}

function PipelineConnector({ state }: { state: 'idle' | 'active' | 'done' }) {
  return (
    <Box
      sx={{
        display: { xs: 'none', lg: 'block' },
        height: 3,
        borderRadius: 2,
        bgcolor: state === 'done' ? alpha('#22d3ee', 0.62) : state === 'active' ? alpha('#38bdf8', 0.82) : alpha('#64748b', 0.22),
        border: `1px solid ${state === 'active' ? alpha('#7dd3fc', 0.9) : alpha('#94a3b8', 0.28)}`,
        backgroundImage: state === 'active' ? `linear-gradient(90deg, transparent 0%, ${alpha('#e2e8f0', 0.95)} 50%, transparent 100%)` : 'none',
        backgroundSize: '160px 100%',
        animation: state === 'active' ? `${flowAnim} 1.2s linear infinite` : 'none'
      }}
    />
  );
}

function PipelineNode({
  title,
  subtitle,
  state,
  tone,
  compact,
  focus,
  extra,
  onClick
}: {
  title: string;
  subtitle: string;
  state: string;
  tone: string;
  compact?: boolean;
  focus?: boolean;
  extra?: string;
  onClick?: () => void;
}) {
  const active = ['start', 'processing'].includes(state);
  const done = state === 'done';
  const runningText = state === 'processing' ? 'is processing…' : state === 'start' ? 'is starting…' : done ? 'is complete' : 'is idle';
  return (
    <Box
      onClick={onClick}
      sx={{
        p: compact ? 0.9 : 1.05,
        borderRadius: 1.8,
        minHeight: compact ? 72 : focus ? 132 : 112,
        cursor: onClick ? 'pointer' : 'default',
        border: `1px solid ${alpha(tone, active ? 0.86 : done ? 0.54 : 0.26)}`,
        background: `linear-gradient(145deg, ${alpha('#020617', 0.94)}, ${alpha(tone, active ? 0.18 : 0.07)})`,
        boxShadow: active ? `0 0 20px ${alpha(tone, 0.58)}` : done ? `0 0 14px ${alpha(tone, 0.38)}` : 'none'
      }}
    >
      <Typography sx={{ fontSize: focus ? 14 : 12.8, letterSpacing: '0.04em', color: alpha(tone, 0.95), fontWeight: 600 }}>{title}</Typography>
      <Typography sx={{ fontSize: 12, color: '#dbeafe', mt: 0.4 }}>{subtitle}</Typography>
      <Typography sx={{ fontSize: 11.2, color: '#8da0bb', mt: 0.6, animation: active ? `${thinkAnim} 1.3s ease-in-out infinite` : 'none' }}>
        {extra || runningText}
      </Typography>
    </Box>
  );
}

function workflowStatusToActiveId(nodes: readonly string[], statusMap: Record<string, string>): string | null {
  const activeNode = nodes.find((node) => ['processing', 'start'].includes(statusMap[node]));
  if (activeNode) return activeNode;
  const doneNode = [...nodes].reverse().find((node) => statusMap[node] === 'done');
  return doneNode || null;
}

function GlassPanel({ children, sx = {} }: { children: React.ReactNode; sx?: object }) {
  return (
    <Box
      sx={{
        p: 1.2,
        borderRadius: 1.8,
        bgcolor: alpha('#0f172a', 0.46),
        border: '1px solid rgba(148,163,184,0.18)',
        backdropFilter: 'blur(14px) saturate(125%)',
        boxShadow: '0 8px 26px rgba(2,6,23,0.35)',
        ...sx
      }}
    >
      {children}
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ p: 0.9, borderRadius: 1.2, bgcolor: alpha('#0f172a', 0.58), mb: 0.6 }}>
      <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>{label}</Typography>
      <Typography sx={{ fontSize: 12.3, textAlign: 'right', ml: 1 }}>{value}</Typography>
    </Stack>
  );
}

function DateBadge({ date }: { date: Date }) {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const day = date.getDate();
  const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  return (
    <Box
      sx={{
        width: 86,
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid rgba(148,163,184,0.3)',
        boxShadow: '0 6px 18px rgba(15,23,42,0.28)',
        my: 0.6
      }}
    >
      <Box sx={{ bgcolor: '#dbeafe', color: '#1e3a8a', px: 1, py: 0.35 }}>
        <Typography sx={{ fontSize: 10, letterSpacing: '0.08em', fontWeight: 700, textAlign: 'center' }}>{weekday}</Typography>
      </Box>
      <Box sx={{ bgcolor: '#bfdbfe', color: '#1d4ed8', px: 1, py: 0.6 }}>
        <Typography sx={{ fontSize: 46, lineHeight: 0.9, fontWeight: 800, textAlign: 'center' }}>{day}</Typography>
      </Box>
      <Box sx={{ bgcolor: '#dbeafe', color: '#1e40af', px: 1, py: 0.4 }}>
        <Typography sx={{ fontSize: 12, letterSpacing: '0.04em', fontWeight: 700, textAlign: 'center' }}>{monthYear}</Typography>
      </Box>
    </Box>
  );
}

const badgeSx = {
  borderRadius: 1.2,
  bgcolor: alpha('#0f172a', 0.62),
  color: '#cbd5e1',
  border: '1px solid rgba(148,163,184,0.2)'
};
