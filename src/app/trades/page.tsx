'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Stack, Typography, alpha } from '@mui/material';

type Trade = { ts?: string; symbol: string; action: string; price: number; reason?: string; status?: string; shares?: number };

const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [limit, setLimit] = useState(40);
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/results`);
        if (!response.ok) return;
        const payload = await response.json() as { trades?: Trade[] };
        setTrades(payload.trades || []);
      } catch {
        // ignore in offline mode
      }
    };

    void load();
  }, []);

  const todayIso = new Date().toISOString().slice(0, 10);
  const visibleTrades = useMemo(() => {
    const filtered = filterDate ? trades.filter((trade) => (trade.ts || '').startsWith(filterDate)) : trades;
    return filtered.slice().reverse().slice(0, limit);
  }, [filterDate, limit, trades]);

  return (
    <Box sx={{ minHeight: '100vh', p: 2.4, bgcolor: '#030508', color: '#e2e8f0' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 2 }} spacing={1}>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 300 }}>Trade history</Typography>
          <Typography sx={{ fontSize: 12, color: '#8da0bb' }}>Full route for detailed records (kept separate from dashboard for beginner clarity).</Typography>
        </Box>
        <Button href="/" variant="outlined" size="small">Back to dashboard</Button>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.4 }}>
        <Typography sx={{ fontSize: 12, color: '#8da0bb' }}>Filter by date</Typography>
        <input type='date' value={filterDate} max={todayIso} onChange={(event) => setFilterDate(event.target.value)} style={{ background: '#0f172a', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 6, padding: '4px 8px' }} />
      </Stack>

      <Stack spacing={0.8}>
        {visibleTrades.map((trade, index) => (
          <Box key={`${trade.ts || index}-${trade.symbol}`} sx={{ p: 1, borderRadius: 1.3, border: '1px solid rgba(148,163,184,0.24)', bgcolor: alpha('#0f172a', 0.55) }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontSize: 12.5 }}>{trade.symbol} · {trade.action} · {trade.shares || 0} sh</Typography>
              <Typography sx={{ fontSize: 12.5 }}>{trade.ts ? new Date(trade.ts).toLocaleString() : 'n/a'}</Typography>
            </Stack>
            <Typography sx={{ fontSize: 12, color: '#93c5fd' }}>Price: ${trade.price.toFixed(2)} · Status: {trade.status || 'n/a'}</Typography>
            <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>{trade.reason || 'No reason provided.'}</Typography>
          </Box>
        ))}
      </Stack>

      {visibleTrades.length < (filterDate ? trades.filter((trade) => (trade.ts || '').startsWith(filterDate)).length : trades.length) ? (
        <Button sx={{ mt: 1.3 }} onClick={() => setLimit((prev) => prev + 40)}>Load more trades</Button>
      ) : null}
    </Box>
  );
}
