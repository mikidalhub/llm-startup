'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Divider, Grid, Stack, Typography } from '@mui/material';

type Decision = {
  id?: number | string;
  ts?: string;
  symbol?: string;
  action?: string;
  sizePct?: number;
  reason?: string;
  source?: string;
  trade?: {
    ts?: string;
    action?: string;
    status?: string;
    shares?: number;
    price?: number;
    reason?: string;
  } | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function DecisionsPage() {
  const [id, setId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [all, setAll] = useState<Decision[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setId(params.get('id'));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const listRes = await fetch(`${API_BASE}/api/decisions`);
        if (listRes.ok) {
          const payload = await listRes.json() as Decision[];
          setAll(payload.slice(0, 40));
        }

        if (id) {
          const detailRes = await fetch(`${API_BASE}/api/decisions/${id}`);
          if (detailRes.ok) setDecision(await detailRes.json() as Decision);
        } else {
          setDecision(null);
        }
      } catch {
        // ignore offline mode
      }
    };

    void load();
  }, [id]);

  const selected = useMemo(() => {
    if (decision) return decision;
    if (!id) return null;
    return all.find((item) => String(item.id) === String(id)) || null;
  }, [all, decision, id]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f7f9fc', p: { xs: 2, md: 4 } }}>
      <Stack spacing={2.5} sx={{ maxWidth: 1080, mx: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography sx={{ fontSize: 30, fontWeight: 300 }}>Decisions</Typography>
            <Typography sx={{ color: '#64748b' }}>Decision feed and a backend-backed detail panel.</Typography>
          </Box>
          <Button component={Link} href="/" variant="outlined">Back</Button>
        </Stack>

        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Card variant="outlined">
              <CardContent>
                <Typography sx={{ mb: 1, fontWeight: 500 }}>Recent records</Typography>
                <Stack spacing={1.1}>
                  {all.map((item) => (
                    <Box key={String(item.id || `${item.symbol}-${item.ts}`)}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip size="small" label={`#${item.id || '-'}`} />
                        <Chip size="small" label={item.symbol || '-'} />
                        <Chip size="small" label={item.action || '-'} color="primary" variant="outlined" />
                        <Typography sx={{ color: '#64748b', fontSize: 13 }}>{item.ts ? new Date(item.ts).toLocaleString() : '—'}</Typography>
                        {item.id ? <Button size="small" href={`/decisions?id=${item.id}`}>Inspect</Button> : null}
                      </Stack>
                      <Typography sx={{ mt: 0.4, color: '#334155' }}>{item.reason || 'No reason provided.'}</Typography>
                      <Divider sx={{ mt: 1 }} />
                    </Box>
                  ))}
                  {!all.length ? <Typography sx={{ color: '#64748b' }}>No decisions available from backend.</Typography> : null}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Card variant="outlined">
              <CardContent>
                <Typography sx={{ mb: 1, fontWeight: 500 }}>Selected decision</Typography>
                {!id ? <Typography sx={{ color: '#64748b' }}>Select any row to inspect a specific decision.</Typography> : null}
                {id && !selected ? <Typography sx={{ color: '#64748b' }}>Decision #{id} not found.</Typography> : null}
                {selected ? (
                  <Stack spacing={1}>
                    <Typography>ID: {selected.id || '—'}</Typography>
                    <Typography>Symbol: {selected.symbol || '—'}</Typography>
                    <Typography>Action: {selected.action || '—'}</Typography>
                    <Typography>Size %: {(selected.sizePct || 0).toFixed(2)}</Typography>
                    <Typography>Timestamp: {selected.ts ? new Date(selected.ts).toLocaleString() : '—'}</Typography>
                    <Typography>Source: {selected.source || 'unknown'}</Typography>
                    <Typography>Reason: {selected.reason || 'No reason provided.'}</Typography>
                    <Divider />
                    <Typography sx={{ fontWeight: 500 }}>Linked trade</Typography>
                    {selected.trade ? (
                      <Typography>
                        {selected.trade.action} · {selected.trade.status} · {(selected.trade.shares || 0).toFixed(4)} @ {selected.trade.price || 0}
                      </Typography>
                    ) : (
                      <Typography sx={{ color: '#64748b' }}>No linked trade.</Typography>
                    )}
                  </Stack>
                ) : null}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
