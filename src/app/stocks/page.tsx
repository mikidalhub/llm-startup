'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';

type StockDetail = {
  symbol: string;
  name?: string;
  currentPrice?: number;
  sector?: string;
  description?: string;
  history?: Array<{ ts: string; close: number }>;
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
    <Box sx={{ minHeight: '100vh', p: 3, bgcolor: '#f1f5f9' }}>
      <Stack spacing={1.4} sx={{ maxWidth: 920, mx: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontSize: 28, fontWeight: 300 }}>{detail?.symbol || symbol}</Typography>
          <Button component={Link} href="/" variant="outlined">Back</Button>
        </Stack>
        <Typography sx={{ fontSize: 15, color: '#334155' }}>{detail?.name || 'Loading name...'}</Typography>
        <Typography sx={{ fontSize: 22, color: '#0f766e' }}>{formatUsd(detail?.currentPrice || 0)}</Typography>
        <Typography sx={{ fontSize: 14, color: '#475569' }}>{detail?.description || error || 'Loading...'}</Typography>

        <Box sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 2 }}>
          <Typography sx={{ fontSize: 13, color: '#475569', mb: 1 }}>Price history (1 month)</Typography>
          <svg viewBox="0 0 100 100" width="100%" height="260" preserveAspectRatio="none" role="img" aria-label="Stock history chart">
            <polyline points={chartPoints} fill="none" stroke="#2563eb" strokeWidth="2.4" />
          </svg>
        </Box>
      </Stack>
    </Box>
  );
}
