'use client';

import { useEffect, useState } from 'react';
import { Box, Chip, Stack, Typography, alpha } from '@mui/material';

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setId(params.get('id'));
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      try {
        const res = await fetch(`${API_BASE}/api/decisions/${id}`);
        if (!res.ok) return;
        setDecision(await res.json());
      } catch {
        // offline preview
      }
    };

    void run();
  }, [id]);


  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#030508', color: '#e2e8f0', p: 2.5 }}>
      <Typography sx={{ fontSize: 11, letterSpacing: '0.2em', color: '#7c8ca3' }}>DECISION RECORD</Typography>
      <Typography sx={{ fontSize: 30, fontWeight: 300, mt: 0.4 }}>Decision #{id || '—'}</Typography>

      <Box sx={{ mt: 1.8, p: 1.4, borderRadius: 1.8, bgcolor: alpha('#0f172a', 0.48), border: '1px solid rgba(148,163,184,0.2)' }}>
        {!id ? (
          <Typography sx={{ color: '#94a3b8' }}>Choose a decision from the home page to inspect full reasoning and outcome.</Typography>
        ) : !decision ? (
          <Typography sx={{ color: '#94a3b8' }}>Loading decision details…</Typography>
        ) : (
          <Stack spacing={1}>
            <Stack direction="row" spacing={0.8}>
              <Chip label={`Symbol ${decision.symbol || '-'}`} sx={{ borderRadius: 1.2, bgcolor: alpha('#0f172a', 0.7), color: '#cbd5e1' }} />
              <Chip label={`Action ${decision.action || '-'}`} sx={{ borderRadius: 1.2, bgcolor: alpha('#0f172a', 0.7), color: '#cbd5e1' }} />
              <Chip label={`Size ${(decision.sizePct || 0).toFixed(2)}`} sx={{ borderRadius: 1.2, bgcolor: alpha('#0f172a', 0.7), color: '#cbd5e1' }} />
            </Stack>
            <Typography sx={{ fontSize: 13, color: '#9fb1c8' }}>Reason: {decision.reason || 'No reason logged.'}</Typography>
            <Typography sx={{ fontSize: 12, color: '#7c8ca3' }}>Created: {decision.ts ? new Date(decision.ts).toLocaleString() : 'n/a'}</Typography>

            <Box sx={{ p: 1.1, borderRadius: 1.3, bgcolor: alpha('#0b1220', 0.58), border: '1px solid rgba(148,163,184,0.15)' }}>
              <Typography sx={{ fontSize: 12, color: '#8da0bb' }}>Outcome</Typography>
              {decision.trade ? (
                <Typography sx={{ fontSize: 12.8 }}>
                  {decision.trade.action} · {decision.trade.status} · {decision.trade.shares?.toFixed(4)} @ {decision.trade.price}
                </Typography>
              ) : (
                <Typography sx={{ fontSize: 12.8, color: '#94a3b8' }}>No linked trade found for this decision.</Typography>
              )}
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
