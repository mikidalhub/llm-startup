'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Drawer,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
  alpha
} from '@mui/material';

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

const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';
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

  useEffect(() => {
    const hydrate = async () => {
      try {
        const bootstrapRes = await fetch(`${API_BASE}/api/bootstrap`);
        if (bootstrapRes.ok) {
          const bootstrap = await bootstrapRes.json();
          if (bootstrap.state) setEngineState(bootstrap.state);
          if (bootstrap.results) setResults(bootstrap.results);
          if (bootstrap.decisions) setDecisions(bootstrap.decisions);
          if (bootstrap.events) setEvents(bootstrap.events);
          return;
        }

        const [stateRes, resultsRes, decisionsRes] = await Promise.all([
          fetch(`${API_BASE}/api/state`),
          fetch(`${API_BASE}/api/results`),
          fetch(`${API_BASE}/api/decisions`)
        ]);

        if (stateRes.ok) setEngineState(await stateRes.json());
        if (resultsRes.ok) setResults(await resultsRes.json());
        if (decisionsRes.ok) setDecisions(await decisionsRes.json());
      } catch {
        // offline preview
      }
    };

    void hydrate();
    const interval = setInterval(() => void hydrate(), 10000);

    if (typeof window !== 'undefined') {
      const stream = new EventSource(`${API_BASE}/events`);
      stream.addEventListener('state', (raw) => {
        try {
          setEngineState(JSON.parse((raw as MessageEvent).data) as EngineState);
        } catch {
          // ignore malformed event
        }
      });
      stream.addEventListener('process', (raw) => {
        try {
          const parsed = JSON.parse((raw as MessageEvent).data) as ProcessEvent;
          setEvents((prev) => [...prev, parsed].slice(-220));
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

      return () => {
        clearInterval(interval);
        stream.close();
      };
    }

    return () => clearInterval(interval);
  }, []);

  const metrics = engineState.portfolio?.metrics || {};
  const equityCurve = engineState.portfolio?.equityCurve || [];
  const now = new Date();
  const todayIso = new Date().toISOString().slice(0, 10);
  const trades = useMemo(() => {
    const source = results.trades || [];
    const filtered = filterDate ? source.filter((trade) => (trade.ts || '').startsWith(filterDate)) : source;
    return filtered.slice(-16).reverse();
  }, [filterDate, results.trades]);
  const operationResults = useMemo(() => {
    const source = results.operationResults || [];
    return filterDate ? source.filter((item) => (item.ts || '').startsWith(filterDate)) : source;
  }, [filterDate, results.operationResults]);
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#030508', color: '#e2e8f0', p: 2.4 }}>
      <Stack spacing={1.8} sx={{ mr: { md: '360px', xs: 0 } }}>
        <Typography sx={{ fontSize: 11, letterSpacing: '0.22em', color: '#7c8ca3' }}>AI MULTI-AGENT TRADING</Typography>

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
          <Typography sx={{ fontSize: 12, color: '#8da0bb', mb: 1 }}>Per-operation results</Typography>
          <Stack spacing={0.6} sx={{ maxHeight: 180, overflowY: 'auto' }}>
            {operationResults.slice(-25).reverse().map((item) => (
              <Stack key={item.id} direction='row' justifyContent='space-between' sx={{ p: 0.7, borderRadius: 1.2, bgcolor: alpha('#0f172a', 0.56) }}>
                <Typography sx={{ fontSize: 12 }}>{item.symbol} · {item.action}</Typography>
                <Typography sx={{ fontSize: 12, color: (item.signedValue || 0) >= 0 ? '#86efac' : '#fca5a5' }}>{formatUsd(item.signedValue || 0)}</Typography>
              </Stack>
            ))}
            {!operationResults.length ? <Typography sx={{ fontSize: 12, color: '#64748b' }}>No operation results for selected date.</Typography> : null}
          </Stack>
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
            <Typography sx={{ fontSize: 12, color: '#64748b' }}>Loaded items: {trades.length} trades · {events.length} logs</Typography>
          </Stack>
        </GlassPanel>

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2}>
          <GlassPanel sx={{ flex: 1, minHeight: 250 }}>
            <Typography sx={{ fontSize: 12, color: '#8da0bb', mb: 1 }}>Equity curve</Typography>
            <EquityCurve points={equityCurve} />
          </GlassPanel>

          <GlassPanel sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 12, color: '#8da0bb', mb: 1 }}>Recent trades</Typography>
            <Stack spacing={0.7}>
              {trades.map((trade, index) => (
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
            bgcolor: alpha('#050911', 0.88),
            color: '#e2e8f0',
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
        <Typography sx={{ fontSize: 12, color: '#8da0bb', mb: 0.6 }}>Live process log</Typography>
        <Stack spacing={0.7} sx={{ maxHeight: '38vh', overflowY: 'auto' }}>
          {events.slice(-18).reverse().map((event, index) => (
            <Box key={`${event.timestamp || index}-${event.type || 'event'}`} sx={{ p: 0.9, borderRadius: 1.2, bgcolor: alpha('#0f172a', 0.56) }}>
              <Typography sx={{ fontSize: 11, color: '#7dd3fc' }}>{event.type || 'event'}{event.node ? ` · ${event.node}` : ''}</Typography>
              <Typography sx={{ fontSize: 12 }}>{event.symbol ? `${event.symbol} · ` : ''}{event.reason || event.action || (event.status ? `status: ${event.status}` : 'state update')}</Typography>
            </Box>
          ))}
        </Stack>

        {selectedDecision?.id ? (
          <Button href={`/decisions?id=${selectedDecision.id}`} size="small" sx={{ mt: 1.4, borderRadius: 1.2 }}>
            Open decision page
          </Button>
        ) : null}
      </Drawer>
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

function EquityCurve({ points }: { points: Array<{ ts: string; value: number }> }) {
  if (!points.length) return <Typography sx={{ fontSize: 12, color: '#64748b' }}>No equity history yet.</Typography>;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);

  const width = 760;
  const height = 170;
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * (width - 22) + 11;
      const y = height - (((point.value - min) / spread) * (height - 20) + 10);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <Box>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="170" role="img" aria-label="equity curve">
        <defs>
          <linearGradient id="eq" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="url(#eq)" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <Stack direction="row" justifyContent="space-between">
        <Typography sx={{ fontSize: 11, color: '#64748b' }}>{new Date(points[0].ts).toLocaleTimeString()}</Typography>
        <Typography sx={{ fontSize: 11, color: '#64748b' }}>{new Date(points.at(-1)!.ts).toLocaleTimeString()}</Typography>
      </Stack>
    </Box>
  );
}

const badgeSx = {
  borderRadius: 1.2,
  bgcolor: alpha('#0f172a', 0.62),
  color: '#cbd5e1',
  border: '1px solid rgba(148,163,184,0.2)'
};
