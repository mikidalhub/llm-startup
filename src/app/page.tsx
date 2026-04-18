'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Slider,
  Stack,
  SwipeableDrawer,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
  Button
} from '@mui/material';

type Snapshot = { symbol: string; price: number; rsi: number; ts: string };
type ResultsPayload = {
  portfolioValue: number;
  positions: Record<string, { shares: number; avgCost: number }>;
  trades: Array<{ ts?: string; symbol: string; action: string; price: number; shares: number; status?: string }>;
};

const glow = (positive: boolean) => `0 0 26px ${positive ? 'rgba(34,197,94,0.28)' : 'rgba(248,113,113,0.26)'}`;
const formatUsd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function HomePage() {
  const [results, setResults] = useState<ResultsPayload>({ portfolioValue: 0, positions: {}, trades: [] });
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [activeSymbol, setActiveSymbol] = useState('AAPL');
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [timeframe, setTimeframe] = useState('1D');
  const [showControls, setShowControls] = useState(false);
  const [tradeSize, setTradeSize] = useState(35);
  const [tradeStep, setTradeStep] = useState<1 | 2>(1);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [resultsRes, stateRes] = await Promise.all([
          fetch(`${API_BASE}/api/results`),
          fetch(`${API_BASE}/api/state`)
        ]);
        if (resultsRes.ok) setResults(await resultsRes.json());
        if (stateRes.ok) {
          const state = await stateRes.json();
          setSnapshots(state.snapshots || {});
          const first = Object.keys(state.snapshots || {})[0];
          if (first) setActiveSymbol(first);
        }
      } catch {
        // quiet fallback for offline demos
      }
    };

    void hydrate();
    const interval = setInterval(() => void hydrate(), 15000);
    return () => clearInterval(interval);
  }, []);

  const symbols = useMemo(() => Object.keys(snapshots), [snapshots]);
  const active = snapshots[activeSymbol] || snapshots[symbols[0]];
  const previousPrice = results.trades.find((trade) => trade.symbol === active?.symbol)?.price || active?.price || 0;
  const change = active ? active.price - previousPrice : 0;
  const changePct = previousPrice ? (change / previousPrice) * 100 : 0;
  const positive = change >= 0;

  const chartPath = useMemo(() => {
    const series = Array.from({ length: 32 }, (_, i) => {
      const wave = Math.sin(i / 5) * 14;
      const trend = i * (positive ? 1.4 : -1.1);
      return Math.max(12, Math.min(88, 58 - wave - trend / 4));
    });
    return series.map((value, index) => `${index === 0 ? 'M' : 'L'} ${(index / (series.length - 1)) * 100} ${value}`).join(' ');
  }, [positive, active?.price]);

  const confirmTrade = () => {
    setTradeStep(1);
    setHistoryOpen(true);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#040507', color: '#f8fafc', p: 2.2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="overline" sx={{ letterSpacing: '0.24em', color: 'rgba(226,232,240,0.6)' }}>PORTFOLIO</Typography>
          <Chip label="Live / Yahoo" size="small" sx={{ bgcolor: 'rgba(15,23,42,0.7)', color: '#94a3b8' }} />
        </Stack>

        <Box sx={{ p: 2.5, borderRadius: 5, bgcolor: 'rgba(15,23,42,0.48)', boxShadow: glow(positive), backdropFilter: 'blur(20px)' }}>
          <Typography sx={{ fontSize: 12, letterSpacing: '0.12em', color: 'rgba(226,232,240,0.6)' }}>Total Value</Typography>
          <Typography sx={{ fontSize: 38, lineHeight: 1.1, fontWeight: 300 }}>{formatUsd(results.portfolioValue)}</Typography>
          <Typography sx={{ mt: 0.7, color: positive ? '#4ade80' : '#f87171' }}>{`${positive ? '+' : ''}${formatUsd(change)} (${changePct.toFixed(2)}%)`}</Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
          {symbols.map((symbol) => (
            <Button
              key={symbol}
              onClick={() => setActiveSymbol(symbol)}
              sx={{
                minWidth: 86,
                borderRadius: 99,
                color: activeSymbol === symbol ? '#0f172a' : '#e2e8f0',
                bgcolor: activeSymbol === symbol ? '#f1f5f9' : 'rgba(15,23,42,0.68)',
                textTransform: 'none'
              }}
            >
              {symbol}
            </Button>
          ))}
        </Stack>

        <Box
          onClick={() => setExpanded((v) => !v)}
          onPointerDown={() => setShowControls(true)}
          sx={{
            position: 'relative',
            borderRadius: 6,
            p: 1.4,
            height: expanded ? 440 : 330,
            bgcolor: alpha('#0f172a', 0.45),
            transition: 'all 260ms ease',
            boxShadow: '0 20px 46px rgba(2,6,23,0.55)'
          }}
        >
          <Stack direction="row" justifyContent="space-between" sx={{ px: 1, pt: 0.5 }}>
            <Typography sx={{ fontSize: 22, fontWeight: 300 }}>{active?.symbol || '—'}</Typography>
            <Typography sx={{ color: positive ? '#4ade80' : '#f87171' }}>{active ? formatUsd(active.price) : '—'}</Typography>
          </Stack>

          <Box sx={{ position: 'absolute', inset: '64px 16px 16px 16px' }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={positive ? 'rgba(34,197,94,0.34)' : 'rgba(239,68,68,0.32)'} />
                  <stop offset="100%" stopColor="rgba(15,23,42,0)" />
                </linearGradient>
              </defs>
              <path d={`${chartPath} L 100 100 L 0 100 Z`} fill="url(#chart-fill)" />
              <path d={chartPath} fill="none" stroke={positive ? '#22c55e' : '#f87171'} strokeWidth="1.35" strokeLinecap="round" />
            </svg>
          </Box>

          {showControls ? (
            <Stack direction="row" justifyContent="space-between" sx={{ position: 'absolute', right: 14, top: 54, left: 14 }}>
              <ToggleButtonGroup size="small" value={timeframe} exclusive onChange={(_, value) => value && setTimeframe(value)}>
                {['1D', '1W', '1M', '1Y'].map((value) => <ToggleButton key={value} value={value}>{value}</ToggleButton>)}
              </ToggleButtonGroup>
              <IconButton onClick={() => setHistoryOpen(true)} sx={{ color: '#e2e8f0' }}>⋯</IconButton>
            </Stack>
          ) : null}
        </Box>

        <Box sx={{ p: 2, borderRadius: 5, bgcolor: 'rgba(15,23,42,0.48)' }}>
          <Typography sx={{ mb: 1, color: '#94a3b8' }}>Trade size</Typography>
          <Slider value={tradeSize} onChange={(_, value) => setTradeSize(Number(value))} />
          {tradeStep === 1 ? (
            <Stack direction="row" spacing={1}>
              <Button fullWidth variant="contained" color="success" onClick={() => setTradeStep(2)}>Buy</Button>
              <Button fullWidth variant="contained" color="error" onClick={() => setTradeStep(2)}>Sell</Button>
            </Stack>
          ) : (
            <Button fullWidth variant="contained" onClick={confirmTrade}>Confirm {tradeSize}%</Button>
          )}
        </Box>
      </Stack>

      <SwipeableDrawer
        anchor="bottom"
        open={historyOpen}
        onOpen={() => setHistoryOpen(true)}
        onClose={() => setHistoryOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 28, borderTopRightRadius: 28, bgcolor: '#080b12', color: '#e2e8f0', p: 2 } }}
      >
        <Typography sx={{ mb: 1.5, fontWeight: 300, fontSize: 24 }}>Transaction history</Typography>
        <Stack spacing={1} sx={{ maxHeight: 300, overflowY: 'auto' }}>
          {results.trades.slice(-20).reverse().map((trade, index) => (
            <Stack key={`${trade.ts || index}-${trade.symbol}`} direction="row" justifyContent="space-between" sx={{ p: 1.2, borderRadius: 3, bgcolor: 'rgba(15,23,42,0.6)' }}>
              <Typography>{trade.symbol} · {trade.action}</Typography>
              <Typography sx={{ color: trade.action === 'BUY' ? '#4ade80' : '#fda4af' }}>{formatUsd(trade.price)}</Typography>
            </Stack>
          ))}
          {!results.trades.length ? <Typography sx={{ color: '#94a3b8' }}>No transactions yet.</Typography> : null}
        </Stack>
      </SwipeableDrawer>
    </Box>
  );
}
