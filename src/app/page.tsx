'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography
} from '@mui/material';

type EngineState = {
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
  };
  lastError?: string | null;
};

type Trade = { ts?: string; symbol?: string; action?: string; price?: number; status?: string; shares?: number; reason?: string };
type Decision = { id?: string | number; ts?: string; symbol?: string; action?: string; sizePct?: number; reason?: string; source?: string };
type Signal = { timestamp?: string; symbol?: string; signal?: string; rsi?: number; price?: number };
type StockDetail = { symbol: string; name?: string; currentPrice?: number | null; sector?: string; totalTrades?: number };
type StocksPayload = { details?: StockDetail[] };
type BootstrapPayload = { state?: EngineState; results?: { signals?: Signal[] } };
type ProcessEvent = { type?: string; status?: string; symbol?: string; payload?: Record<string, unknown>; timestamp?: string };

const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';

const formatUsd = (value?: number | null) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

const asLocal = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function HomePage() {
  const [state, setState] = useState<EngineState>({});
  const [stocks, setStocks] = useState<StockDetail[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [error, setError] = useState('');
  const [ollamaMessages, setOllamaMessages] = useState<string[]>([]);
  const [liveReasoning, setLiveReasoning] = useState('');

  const loadDashboard = useCallback(async () => {
    setError('');
    try {
      const [bootstrapRes, stocksRes, decisionsRes, tradesRes, signalsRes] = await Promise.all([
        fetch(`${API_BASE}/api/bootstrap`),
        fetch(`${API_BASE}/api/stocks`),
        fetch(`${API_BASE}/api/decisions`),
        fetch(`${API_BASE}/api/trades`),
        fetch(`${API_BASE}/api/signals`)
      ]);

      if (bootstrapRes.ok) {
        const payload = (await bootstrapRes.json()) as BootstrapPayload;
        setState(payload.state || {});
        setSignals(payload.results?.signals || []);
      }

      if (stocksRes.ok) {
        const payload = (await stocksRes.json()) as StocksPayload;
        setStocks(payload.details || []);
      }

      if (decisionsRes.ok) {
        const payload = (await decisionsRes.json()) as Decision[];
        setDecisions(payload.slice(0, 8));
      }

      if (tradesRes.ok) {
        const payload = (await tradesRes.json()) as Trade[];
        setTrades(payload.slice(-8).reverse());
      }

      if (signalsRes.ok) {
        const payload = (await signalsRes.json()) as Signal[];
        if (payload.length) setSignals(payload.slice(-8).reverse());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let source: EventSource | null = null;
    const connect = () => {
      source = new EventSource(`${API_BASE}/events`);
      source.addEventListener('open', () => setSseConnected(true));
      source.addEventListener('state', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as EngineState;
          setState(payload);
        } catch {
          // ignore parse issues
        }
      });
      source.addEventListener('process', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as ProcessEvent;
          if (payload.type === 'LLM_STREAM') {
            const token = String(payload.payload?.token || '');
            if (!token) return;
            setLiveReasoning((prev) => `${prev}${token}`.slice(-3000));
            return;
          }

          if (payload.type === 'OLLAMA_STATE') {
            const status = payload.status || 'UNKNOWN';
            const detail = payload.payload ? JSON.stringify(payload.payload) : '';
            setOllamaMessages((prev) => [`${asLocal(payload.timestamp)} · ${status} ${detail}`.trim(), ...prev].slice(0, 12));
            if (status === 'REQUEST_STARTED') setLiveReasoning('');
          }
        } catch {
          // ignore parse issues
        }
      });
      source.addEventListener('error', () => {
        setSseConnected(false);
        source?.close();
        setTimeout(connect, 2000);
      });
    };

    connect();
    return () => source?.close();
  }, []);

  const metrics = state.portfolio?.metrics;
  const positionsCount = useMemo(() => Object.keys(state.portfolio?.positions || {}).length, [state.portfolio?.positions]);

  const triggerTick = async () => {
    setTriggering(true);
    try {
      await fetch(`${API_BASE}/api/process/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'UI_MANUAL_TRIGGER' }) });
      setTimeout(() => {
        setRefreshing(true);
        void loadDashboard();
      }, 600);
    } catch {
      setError('Failed to trigger workflow.');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f7f9fc', color: '#0f172a', p: { xs: 2, md: 4 } }}>
      <Stack spacing={3} sx={{ maxWidth: 1180, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5}>
          <Box>
            <Typography sx={{ fontSize: 34, fontWeight: 300 }}>Trading workflow</Typography>
            <Typography sx={{ color: '#475569' }}>Minimal UI driven only by live backend endpoints and current engine state.</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" component={Link} href="/trades">Trades</Button>
            <Button variant="outlined" component={Link} href="/stocks">Stocks</Button>
            <Button variant="outlined" component={Link} href="/decisions">Decisions</Button>
            <Button variant="contained" onClick={triggerTick} disabled={triggering}>{triggering ? 'Starting…' : 'Run tick'}</Button>
            <Button variant="text" onClick={() => { setRefreshing(true); void loadDashboard(); }} disabled={refreshing}>Refresh</Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="warning">{error}</Alert> : null}

        <Grid container spacing={2}>
          {[{
            label: 'Engine stage',
            value: state.status?.stage || 'idle'
          }, {
            label: 'Engine running',
            value: state.status?.running ? 'yes' : 'no'
          }, {
            label: 'Last run',
            value: asLocal(state.status?.lastRunAt)
          }, {
            label: 'Stream',
            value: sseConnected ? 'connected' : 'disconnected'
          }].map((item) => (
            <Grid key={item.label} item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography sx={{ color: '#64748b', fontSize: 13 }}>{item.label}</Typography>
                  <Typography sx={{ mt: 0.6, fontSize: 20 }}>{item.value}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography sx={{ fontSize: 18, fontWeight: 500, mb: 1 }}>Portfolio metrics</Typography>
                <Stack spacing={1}>
                  <Typography>Portfolio value: {formatUsd(metrics?.portfolioValue)}</Typography>
                  <Typography>PnL: {formatUsd(metrics?.pnl)}</Typography>
                  <Typography>Sharpe: {(metrics?.sharpe || 0).toFixed(2)}</Typography>
                  <Typography>Win rate: {((metrics?.winRate || 0) * 100).toFixed(2)}%</Typography>
                  <Typography>Max drawdown: {((metrics?.maxDrawdown || 0) * 100).toFixed(2)}%</Typography>
                  <Typography>Avg profit/trade: {formatUsd(metrics?.avgProfitPerTrade)}</Typography>
                  <Typography>Open positions: {positionsCount}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography sx={{ fontSize: 18, fontWeight: 500, mb: 1 }}>Tracked stocks</Typography>
                <Stack spacing={1}>
                  {loading ? <CircularProgress size={20} /> : stocks.slice(0, 8).map((stock) => (
                    <Stack key={stock.symbol} direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={stock.symbol} size="small" />
                        <Typography>{stock.name || stock.symbol}</Typography>
                      </Stack>
                      <Typography sx={{ color: '#334155' }}>{formatUsd(stock.currentPrice)} · {stock.totalTrades || 0} trades</Typography>
                    </Stack>
                  ))}
                  {!loading && !stocks.length ? <Typography sx={{ color: '#64748b' }}>No stocks currently tracked.</Typography> : null}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography sx={{ fontSize: 18, fontWeight: 500, mb: 1 }}>Recent decisions</Typography>
                <Stack spacing={1.1}>
                  {decisions.map((decision) => (
                    <Box key={String(decision.id || `${decision.symbol}-${decision.ts}`)}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip label={decision.symbol || '-'} size="small" />
                        <Chip label={decision.action || '-'} size="small" color="primary" variant="outlined" />
                        <Typography sx={{ color: '#64748b', fontSize: 13 }}>{asLocal(decision.ts)}</Typography>
                        {decision.id ? <Button component={Link} href={`/decisions?id=${decision.id}`} size="small">Open</Button> : null}
                      </Stack>
                      <Typography sx={{ color: '#334155', mt: 0.5, fontSize: 14 }}>{decision.reason || 'No reason available.'}</Typography>
                      <Divider sx={{ mt: 1 }} />
                    </Box>
                  ))}
                  {!decisions.length ? <Typography sx={{ color: '#64748b' }}>No decisions available.</Typography> : null}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography sx={{ fontSize: 18, fontWeight: 500, mb: 1 }}>Latest trades & signals</Typography>
                <Stack spacing={1.2}>
                  {trades.slice(0, 4).map((trade, idx) => (
                    <Typography key={`${trade.ts || idx}-${trade.symbol}`} sx={{ fontSize: 14 }}>
                      {trade.symbol || '-'} {trade.action || '-'} · {(trade.shares || 0).toFixed(4)} @ {formatUsd(trade.price)} · {asLocal(trade.ts)}
                    </Typography>
                  ))}
                  {!trades.length ? <Typography sx={{ color: '#64748b' }}>No trades available.</Typography> : null}
                  <Divider />
                  {signals.slice(0, 4).map((signal, idx) => (
                    <Typography key={`${signal.timestamp || idx}-${signal.symbol}`} sx={{ fontSize: 14, color: '#334155' }}>
                      {signal.symbol || '-'} {signal.signal || '-'} · RSI {(signal.rsi || 0).toFixed(2)} · {formatUsd(signal.price)}
                    </Typography>
                  ))}
                  {!signals.length ? <Typography sx={{ color: '#64748b' }}>No signals available.</Typography> : null}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography sx={{ fontSize: 18, fontWeight: 500, mb: 1 }}>Live Ollama reasoning stream</Typography>
                <Box sx={{ bgcolor: '#0b1020', color: '#dbeafe', borderRadius: 1, p: 1.5, minHeight: 120, maxHeight: 220, overflow: 'auto' }}>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                    {liveReasoning || 'Waiting for LLM stream tokens...'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography sx={{ fontSize: 18, fontWeight: 500, mb: 1 }}>Real-time Ollama state</Typography>
                <Stack spacing={0.8}>
                  {ollamaMessages.map((message, idx) => (
                    <Typography key={`${message}-${idx}`} sx={{ fontSize: 12, color: '#334155' }}>{message}</Typography>
                  ))}
                  {!ollamaMessages.length ? <Typography sx={{ color: '#64748b' }}>No Ollama state events yet.</Typography> : null}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

      </Stack>
    </Box>
  );
}
