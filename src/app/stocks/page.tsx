'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';

const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';

type StockDetail = {
  symbol: string;
  name?: string;
  currentPrice?: number;
  sector?: string;
  description?: string;
  history?: Array<{ ts: string; close: number }>;
  totalTrades?: number;
};

const formatUsd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

export default function StockDetailPage() {
  const [symbol, setSymbol] = useState('AAPL');
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('symbol');
    setSymbol((token || 'AAPL').toUpperCase());
  }, []);

  useEffect(() => {
    const fetchDetail = async () => {
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/stocks/${symbol}`);
        if (!res.ok) throw new Error('Unable to load stock detail.');
        setDetail(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load stock detail.');
      }
    };

    void fetchDetail();
  }, [symbol]);

  const history = detail?.history || [];
  const chartPoints = useMemo(() => {
    if (!history.length) return '';
    const closes = history.map((point) => point.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    return history
      .map((point, idx) => {
        const x = (idx / Math.max(history.length - 1, 1)) * 100;
        const y = max === min ? 50 : 100 - ((point.close - min) / (max - min)) * 100;
        return `${x},${y}`;
      })
      .join(' ');
  }, [history]);

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 2, md: 4 }, bgcolor: '#f7f9fc' }}>
      <Stack spacing={2} sx={{ maxWidth: 920, mx: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography sx={{ fontSize: 32, fontWeight: 300 }}>{detail?.symbol || symbol}</Typography>
            <Typography sx={{ color: '#64748b' }}>{detail?.name || 'Loading name...'}</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button component={Link} href="/" variant="outlined">Back</Button>
            <Button component={Link} href="/stocks?symbol=MSFT" variant="text">MSFT</Button>
            <Button component={Link} href="/stocks?symbol=NVDA" variant="text">NVDA</Button>
          </Stack>
        </Stack>

        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
              <Typography sx={{ fontSize: 26, color: '#0f766e' }}>{formatUsd(detail?.currentPrice || 0)}</Typography>
              <Stack direction="row" spacing={1}>
                <Chip label={detail?.sector || 'Unknown sector'} />
                <Chip label={`${detail?.totalTrades || 0} trades`} variant="outlined" />
              </Stack>
            </Stack>
            <Typography sx={{ mt: 1, color: '#334155' }}>{detail?.description || error || 'Loading...'}</Typography>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography sx={{ fontSize: 13, color: '#64748b', mb: 1 }}>Price history (1 month from backend)</Typography>
            <svg viewBox="0 0 100 100" width="100%" height="250" preserveAspectRatio="none" role="img" aria-label="Stock history chart">
              <polyline points={chartPoints} fill="none" stroke="#2563eb" strokeWidth="2.4" />
            </svg>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
