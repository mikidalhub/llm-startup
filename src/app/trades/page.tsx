'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';

type Trade = { ts?: string; symbol?: string; action?: string; price?: number; reason?: string; status?: string; shares?: number };

const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';

const formatUsd = (value?: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [date, setDate] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const url = date ? `${API_BASE}/api/trades?date=${date}` : `${API_BASE}/api/trades`;
        const response = await fetch(url);
        if (!response.ok) return;
        const payload = await response.json() as Trade[];
        setTrades(payload.slice().reverse());
      } catch {
        // ignore offline mode
      }
    };

    void load();
  }, [date]);

  const stats = useMemo(() => {
    const total = trades.length;
    const buys = trades.filter((item) => item.action === 'BUY').length;
    const sells = trades.filter((item) => item.action === 'SELL').length;
    const holds = trades.filter((item) => item.action === 'HOLD').length;
    return { total, buys, sells, holds };
  }, [trades]);

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f7f9fc', p: { xs: 2, md: 4 } }}>
      <Stack spacing={2.5} sx={{ maxWidth: 1050, mx: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography sx={{ fontSize: 30, fontWeight: 300 }}>Trades</Typography>
            <Typography sx={{ color: '#64748b' }}>Raw trade records from <code>/api/trades</code>.</Typography>
          </Box>
          <Button component={Link} href="/" variant="outlined">Back</Button>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
          <Typography sx={{ color: '#475569' }}>Filter by date:</Typography>
          <input
            type="date"
            value={date}
            max={todayIso}
            onChange={(event) => setDate(event.target.value)}
            style={{ background: 'white', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 10px' }}
          />
          {date ? <Button size="small" onClick={() => setDate('')}>Clear</Button> : null}
          <Chip label={`${stats.total} total`} />
          <Chip label={`${stats.buys} buy`} color="success" variant="outlined" />
          <Chip label={`${stats.sells} sell`} color="warning" variant="outlined" />
          <Chip label={`${stats.holds} hold`} color="default" variant="outlined" />
        </Stack>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.1}>
              {trades.map((trade, index) => (
                <Box key={`${trade.ts || index}-${trade.symbol}`} sx={{ p: 1.2, borderRadius: 1.2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={0.5}>
                    <Typography>{trade.symbol || '-'} · {trade.action || '-'} · {(trade.shares || 0).toFixed(4)} shares</Typography>
                    <Typography sx={{ color: '#64748b' }}>{trade.ts ? new Date(trade.ts).toLocaleString() : '—'}</Typography>
                  </Stack>
                  <Typography sx={{ color: '#334155', fontSize: 14 }}>Price: {formatUsd(trade.price)} · Status: {trade.status || '—'}</Typography>
                  <Typography sx={{ color: '#64748b', fontSize: 14 }}>{trade.reason || 'No reason provided.'}</Typography>
                </Box>
              ))}
              {!trades.length ? <Typography sx={{ color: '#64748b' }}>No trades for this filter.</Typography> : null}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
