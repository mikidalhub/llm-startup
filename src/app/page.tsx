'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  LinearProgress,
  Stack,
  Typography
} from '@mui/material';

type Thesis = {
  valuationScore?: number;
  businessQualityScore?: number;
  financialHealthScore?: number;
  growthScore?: number;
  riskScore?: number;
  fairValueEstimate?: number;
  marginOfSafety?: number;
  finalRecommendation?: 'BUY' | 'HOLD' | 'SELL' | string;
  autopilotAction?: string;
  recommendationConfidence?: number;
  teacherExplanation?: { summary?: string; fullText?: string; stepByStep?: string[]; source?: string } | null;
};

type EngineState = {
  status?: { stage?: string; running?: boolean; message?: string; lastRunAt?: string | null };
  snapshots?: Record<string, { symbol?: string; price?: number }>;
  latestDecisionIntelligence?: (Thesis & { symbol?: string }) | null;
  teacherExplanation?: Thesis['teacherExplanation'];
  mlflowRunId?: string | null;
};

type BootstrapPayload = { state?: EngineState };

type ProcessEvent = { type?: string; timestamp?: string; message?: string; payload?: { token?: string } & Record<string, unknown> };

const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';

const formatUsd = (value?: number | null) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

const formatPct = (value?: number | null) => `${((value || 0) * 100).toFixed(1)}%`;

const scoreColor = (score: number) => (score >= 70 ? '#15803d' : score >= 50 ? '#0369a1' : '#b91c1c');

const ScoreBar = ({ label, value }: { label: string; value: number }) => (
  <Box>
    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.6 }}>
      <Typography sx={{ color: '#334155' }}>{label}</Typography>
      <Typography sx={{ color: '#0f172a', fontWeight: 600 }}>{Math.round(value)}/100</Typography>
    </Stack>
    <LinearProgress
      variant="determinate"
      value={Math.max(0, Math.min(100, value))}
      sx={{
        height: 10,
        borderRadius: 99,
        bgcolor: '#e2e8f0',
        '& .MuiLinearProgress-bar': { bgcolor: scoreColor(value) }
      }}
    />
  </Box>
);

export default function HomePage() {
  const [state, setState] = useState<EngineState>({});
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [error, setError] = useState('');
  const [showExplanation, setShowExplanation] = useState(true);
  const [showLiveDrawer, setShowLiveDrawer] = useState(false);
  const [processEvents, setProcessEvents] = useState<ProcessEvent[]>([]);
  const [llmStreamText, setLlmStreamText] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      const bootstrapRes = await fetch(`${API_BASE}/api/bootstrap`);
      if (!bootstrapRes.ok) throw new Error(`Bootstrap request failed (${bootstrapRes.status})`);
      const payload = (await bootstrapRes.json()) as BootstrapPayload;
      setState(payload.state || {});
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
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
          setError('Received malformed state update.');
        }
      });
      source.addEventListener('process', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as ProcessEvent;
          setProcessEvents((prev) => [payload, ...prev].slice(0, 50));
          if (payload.type === 'LLM_STREAM' && typeof payload.payload?.token === 'string') {
            setLlmStreamText((prev) => `${prev}${payload.payload?.token}`.slice(-1500));
          }
        } catch {
          // keep stream alive
        }
      });
      source.addEventListener('error', () => {
        setSseConnected(false);
        source?.close();
        setTimeout(connect, 2500);
      });
    };

    connect();
    return () => source?.close();
  }, []);

  const thesis = state.latestDecisionIntelligence || {};
  const symbol = thesis.symbol || Object.keys(state.snapshots || {})[0] || 'N/A';
  const currentPrice = state.snapshots?.[symbol]?.price || 0;
  const recommendation = String(thesis.finalRecommendation || 'HOLD').toUpperCase();
  const confidence = thesis.recommendationConfidence || 0;

  const recommendationColor = useMemo(() => {
    if (recommendation === 'BUY') return '#15803d';
    if (recommendation === 'SELL') return '#b91c1c';
    return '#334155';
  }, [recommendation]);

  const triggerTick = async () => {
    setTriggering(true);
    try {
      await fetch(`${API_BASE}/api/process/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'UI_MANUAL_TRIGGER' }) });
    } catch {
      setError('Unable to start analysis. Please retry.');
    } finally {
      setTriggering(false);
    }
  };

  const teacher = thesis.teacherExplanation || state.teacherExplanation || { summary: 'Explanation is being prepared.', stepByStep: [] };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fff', p: { xs: 2, md: 5 } }}>
      <Stack spacing={2.5} sx={{ maxWidth: 980, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }}>
          <Box>
            <Typography sx={{ fontSize: 35, fontWeight: 300 }}>Autonomous Beginner Investing Mentor</Typography>
            <Typography sx={{ color: '#64748b' }}>A disciplined, transparent recommendation with simple teaching guidance.</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => void loadDashboard()}>Refresh</Button>
            <Button variant="contained" onClick={triggerTick} disabled={triggering}>{triggering ? 'Starting…' : 'Run analysis'}</Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="warning">{error}</Alert> : null}
        {!sseConnected ? <Alert severity="info">Live stream disconnected. The page will keep retrying automatically.</Alert> : null}

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography sx={{ color: '#64748b', mb: 1 }}>FINAL DECISION</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
              <Stack spacing={1}>
                <Chip label={symbol} sx={{ width: 'fit-content' }} />
                <Typography sx={{ fontSize: 40, fontWeight: 600, color: recommendationColor }}>{recommendation}</Typography>
                <Typography>Confidence: {(confidence * 100).toFixed(0)}%</Typography>
                <Typography>Autopilot action: {thesis.autopilotAction || 'WAIT'}</Typography>
              </Stack>
              <Stack spacing={0.8}>
                <Typography>Current price: {formatUsd(currentPrice)}</Typography>
                <Typography>Fair value estimate: {formatUsd(thesis.fairValueEstimate)}</Typography>
                <Typography>Margin of safety: {formatPct(thesis.marginOfSafety)}</Typography>
                <Typography sx={{ color: '#64748b' }}>Status: {state.status?.stage || 'IDLE'} {loading ? '(loading...)' : ''}</Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography sx={{ color: '#64748b', mb: 2 }}>WHY THIS DECISION</Typography>
            <Stack spacing={1.5}>
              <ScoreBar label="Valuation" value={Number(thesis.valuationScore || 0)} />
              <ScoreBar label="Business Quality" value={Number(thesis.businessQualityScore || 0)} />
              <ScoreBar label="Financial Health" value={Number(thesis.financialHealthScore || 0)} />
              <ScoreBar label="Growth" value={Number(thesis.growthScore || 0)} />
              <ScoreBar label="Risk" value={Number(thesis.riskScore || 0)} />
            </Stack>
            <Button size="small" sx={{ mt: 1 }} onClick={() => setShowExplanation((prev) => !prev)}>
              {showExplanation ? 'Hide explanation' : 'Show explanation'}
            </Button>
            <Collapse in={showExplanation}>
              <Stack spacing={1} sx={{ mt: 1.2 }}>
                <Typography sx={{ fontWeight: 500 }}>{teacher.summary || 'Explanation unavailable. Using deterministic rules only.'}</Typography>
                {(teacher.stepByStep || []).map((line, idx) => (
                  <Typography key={`${line}-${idx}`} sx={{ color: '#334155' }}>{idx + 1}. {line}</Typography>
                ))}
              </Stack>
            </Collapse>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Button size="small" onClick={() => setShowLiveDrawer((prev) => !prev)}>
              {showLiveDrawer ? 'Hide live thinking drawer' : 'Show live thinking drawer'}
            </Button>
            <Collapse in={showLiveDrawer}>
              <Stack spacing={1.2} sx={{ mt: 1.2 }}>
                <Typography sx={{ color: '#64748b' }}>LIVE THINKING</Typography>
                <Typography sx={{ fontSize: 13, color: '#334155' }}>Ollama reasoning stream:</Typography>
                <Typography sx={{ p: 1.2, bgcolor: '#f8fafc', borderRadius: 2, minHeight: 60, fontSize: 13 }}>{llmStreamText || 'Waiting for stream tokens...'}</Typography>
                <Typography sx={{ fontSize: 13 }}>MLflow run id: {state.mlflowRunId || 'Unavailable'}</Typography>
                <Typography sx={{ fontSize: 13, color: '#64748b' }}>Recent process events:</Typography>
                <Stack spacing={0.5}>
                  {processEvents.slice(0, 8).map((event, idx) => (
                    <Typography key={`${event.timestamp || idx}-${event.type}`} sx={{ fontSize: 12, color: '#334155' }}>
                      {(event.timestamp || '').replace('T', ' ').slice(0, 19)} · {event.type || 'event'}
                    </Typography>
                  ))}
                  {!processEvents.length ? <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>No process events yet.</Typography> : null}
                </Stack>
              </Stack>
            </Collapse>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
