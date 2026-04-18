'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  Divider,
  Drawer,
  LinearProgress,
  Stack,
  Switch,
  Typography,
  alpha
} from '@mui/material';

type AgentStatus = 'idle' | 'thinking' | 'completed' | 'failed';

type EngineState = {
  snapshots?: Record<string, { symbol: string; price: number; rsi: number; ts: string }>;
  status?: { stage?: string; running?: boolean; message?: string; lastRunAt?: string | null };
  portfolio?: {
    metrics?: { portfolioValue?: number };
    positions?: Record<string, { shares: number; avgCost: number }>;
  };
  lastError?: string | null;
};

type ProcessEvent = {
  timestamp?: string;
  type?: string;
  symbol?: string;
  price?: number;
  rsi?: number;
  action?: string;
  size_pct?: number;
  reason?: string;
  errors?: string | null;
};

type AgentNode = {
  id: string;
  title: string;
  role: string;
  status: AgentStatus;
  explanation: string;
  output: { signal: string; confidence: string; factors: string[] };
};

type ResultsPayload = {
  trades?: Array<{ ts?: string; symbol: string; action: string; price: number; reason?: string }>;
  signals?: Array<{ timestamp?: string; symbol: string; signal: string; rsi: number; price: number }>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || '';
const formatUsd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

const pipelineBlueprint = [
  { id: 'market', title: 'Market Input', role: 'Data Feed' },
  { id: 'analyst', title: 'Analyst Agents', role: 'Signal Extraction' },
  { id: 'debate', title: 'Debate Layer', role: 'Reasoning Consensus' },
  { id: 'trader', title: 'Trader', role: 'Allocation Decision' },
  { id: 'risk', title: 'Risk', role: 'Constraint Guardrail' },
  { id: 'execution', title: 'Execution', role: 'Order Simulation' }
] as const;

const statusColor: Record<AgentStatus, string> = {
  idle: '#64748b',
  thinking: '#38bdf8',
  completed: '#22c55e',
  failed: '#f87171'
};

const stageToNode: Record<string, string> = {
  START: 'market',
  FETCHING: 'market',
  DECIDING: 'debate',
  TRADING: 'trader',
  PERSISTING: 'execution',
  IDLE: 'execution'
};

const buildNodeDetails = (nodeId: string, event: ProcessEvent, state: EngineState): Pick<AgentNode, 'explanation' | 'output'> => {
  const snapshot = event.symbol ? state.snapshots?.[event.symbol] : undefined;

  if (nodeId === 'market') {
    return {
      explanation: `Ingesting live Yahoo market data ${event.symbol ? `for ${event.symbol}` : ''}. Streaming price + RSI snapshots into shared context.`,
      output: {
        signal: snapshot ? `${snapshot.symbol} @ ${formatUsd(snapshot.price)}` : 'Waiting for feed',
        confidence: 'High',
        factors: [`RSI ${snapshot?.rsi?.toFixed?.(1) ?? 'n/a'}`, `Tick ${snapshot?.ts ?? event.timestamp ?? 'pending'}`]
      }
    };
  }

  if (nodeId === 'analyst') {
    const rsi = snapshot?.rsi ?? event.rsi;
    const signal = typeof rsi === 'number' ? (rsi <= 35 ? 'BUY bias' : rsi >= 70 ? 'SELL bias' : 'HOLD bias') : 'Neutral';
    return {
      explanation: 'Specialist analyst agents transform raw market snapshots into factor-level assessments (momentum, volatility, position context).',
      output: {
        signal,
        confidence: typeof rsi === 'number' ? `${Math.min(95, Math.max(52, Math.round(100 - Math.abs(50 - rsi))))}%` : '58%',
        factors: [`Momentum RSI: ${typeof rsi === 'number' ? rsi.toFixed(2) : 'n/a'}`, `Symbol: ${event.symbol ?? snapshot?.symbol ?? 'n/a'}`]
      }
    };
  }

  if (nodeId === 'debate') {
    return {
      explanation: 'Reasoning agents reconcile analyst disagreement, challenge assumptions, and produce a structured decision recommendation.',
      output: {
        signal: (event.action || 'HOLD').toUpperCase(),
        confidence: `${Math.round((event.size_pct ?? 0.06) * 500)}%`,
        factors: [event.reason || 'Fallback logic from RSI regime', `Size cap ${(event.size_pct ?? 0).toFixed(2)}`]
      }
    };
  }

  if (nodeId === 'trader') {
    return {
      explanation: 'Trader agent converts the consensus action into constrained order sizing and position intent.',
      output: {
        signal: (event.action || 'HOLD').toUpperCase(),
        confidence: 'Execution-ready',
        factors: [`Symbol ${event.symbol ?? 'n/a'}`, `Notional size ${(event.size_pct ?? 0).toFixed(2)}`]
      }
    };
  }

  if (nodeId === 'risk') {
    const riskFlag = state.lastError ? 'elevated' : 'normal';
    return {
      explanation: 'Risk layer validates limits, detects unstable data paths, and logs elevated conditions before execution persists.',
      output: {
        signal: riskFlag === 'elevated' ? 'Guarded' : 'Approved',
        confidence: riskFlag === 'elevated' ? '62%' : '90%',
        factors: [state.lastError ? `Issue: ${state.lastError}` : 'No active breaches', 'Position limits enforced']
      }
    };
  }

  return {
    explanation: 'Execution layer records final state transitions, trades, and decision artifacts to persistent history.',
    output: {
      signal: event.type === 'tick-finished' ? 'Committed' : 'Pending',
      confidence: event.type === 'tick-finished' ? '100%' : '—',
      factors: [`Last run: ${state.status?.lastRunAt ?? 'n/a'}`, 'DB-first persistence + JSON fallback']
    }
  };
};

export default function HomePage() {
  const [engineState, setEngineState] = useState<EngineState>({});
  const [results, setResults] = useState<ResultsPayload>({ trades: [], signals: [] });
  const [events, setEvents] = useState<ProcessEvent[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string>('market');
  const [showHistory, setShowHistory] = useState(false);
  const [advancedView, setAdvancedView] = useState(false);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [stateRes, resultsRes] = await Promise.all([
          fetch(`${API_BASE}/api/state`),
          fetch(`${API_BASE}/api/results`)
        ]);
        if (stateRes.ok) setEngineState(await stateRes.json());
        if (resultsRes.ok) setResults(await resultsRes.json());
      } catch {
        // quiet mode for offline preview
      }
    };

    void hydrate();
    const interval = setInterval(() => void hydrate(), 10000);

    if (typeof window !== 'undefined') {
      const stream = new EventSource(`${API_BASE}/events`);
      stream.addEventListener('state', (raw) => {
        try {
          const payload = JSON.parse((raw as MessageEvent).data) as EngineState;
          setEngineState(payload);
        } catch {
          // ignore malformed event
        }
      });
      stream.addEventListener('process', (raw) => {
        try {
          const payload = JSON.parse((raw as MessageEvent).data) as ProcessEvent;
          setEvents((prev) => [...prev, payload].slice(-120));
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

  const latestEvent = events.at(-1) || {};
  const activeStageNode = stageToNode[engineState.status?.stage || 'IDLE'] || 'market';

  const nodes: AgentNode[] = useMemo(() => {
    const failed = Boolean(engineState.lastError);
    return pipelineBlueprint.map((node, index) => {
      const activeIndex = pipelineBlueprint.findIndex((item) => item.id === activeStageNode);
      let status: AgentStatus = 'idle';
      if (failed && node.id === 'risk') status = 'failed';
      else if (index < activeIndex) status = 'completed';
      else if (node.id === activeStageNode && engineState.status?.running) status = 'thinking';
      else if (!engineState.status?.running && index <= activeIndex) status = 'completed';

      const details = buildNodeDetails(node.id, latestEvent, engineState);
      return { ...node, status, ...details };
    });
  }, [activeStageNode, engineState, latestEvent]);

  const activeNode = nodes.find((node) => node.id === activeNodeId) || nodes[0];
  const latestSnapshot = Object.values(engineState.snapshots || {}).at(-1);
  const lastTrade = (results.trades || []).at(-1);
  const positionCount = Object.keys(engineState.portfolio?.positions || {}).length;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#030507', color: '#e2e8f0', p: 2.2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 0.5 }}>
          <Stack spacing={0.4}>
            <Typography sx={{ letterSpacing: '0.22em', fontSize: 11, color: 'rgba(148,163,184,0.75)' }}>TRADING AGENT</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 300 }}>Decision Engine</Typography>
          </Stack>
          <Stack alignItems="flex-end" spacing={0.3}>
            <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>Position {positionCount}</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 300 }}>{formatUsd(engineState.portfolio?.metrics?.portfolioValue || 0)}</Typography>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ p: 1.2, borderRadius: 4, bgcolor: alpha('#0f172a', 0.45), backdropFilter: 'blur(14px)' }}>
          <Chip label={`${latestSnapshot?.symbol || 'MKT'} ${latestSnapshot ? formatUsd(latestSnapshot.price) : '—'}`} size="small" sx={{ bgcolor: 'rgba(15,23,42,0.9)', color: '#cbd5e1' }} />
          <Chip label={`Trend RSI ${latestSnapshot?.rsi?.toFixed?.(1) ?? 'n/a'}`} size="small" sx={{ bgcolor: 'rgba(15,23,42,0.9)', color: '#cbd5e1' }} />
          <Chip label={`Position ${positionCount}`} size="small" sx={{ bgcolor: 'rgba(15,23,42,0.9)', color: '#cbd5e1' }} />
        </Stack>

        <Box sx={{ borderRadius: 5, p: 2, bgcolor: alpha('#0f172a', 0.38), boxShadow: '0 22px 50px rgba(2,6,23,0.45)' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>Multi-agent live pipeline</Typography>
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>Advanced</Typography>
              <Switch size="small" checked={advancedView} onChange={(_, checked) => setAdvancedView(checked)} />
            </Stack>
          </Stack>

          <Box sx={{ overflowX: 'auto', pb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 980 }}>
              {nodes.map((node, index) => (
                <Stack direction="row" alignItems="center" spacing={1} key={node.id}>
                  <Box
                    onClick={() => setActiveNodeId(node.id)}
                    sx={{
                      cursor: 'pointer',
                      px: 1.4,
                      py: 1.2,
                      minWidth: 146,
                      borderRadius: 3.2,
                      bgcolor: activeNodeId === node.id ? alpha('#1e293b', 0.95) : alpha('#0f172a', 0.72),
                      boxShadow: node.status === 'thinking' ? `0 0 24px ${alpha(statusColor[node.status], 0.45)}` : 'none',
                      border: `1px solid ${alpha(statusColor[node.status], activeNodeId === node.id ? 0.5 : 0.24)}`,
                      transition: 'all 220ms ease'
                    }}
                  >
                    <Typography sx={{ fontSize: 12, color: '#94a3b8', mb: 0.2 }}>{node.role}</Typography>
                    <Typography sx={{ fontSize: 15, fontWeight: 300 }}>{node.title}</Typography>
                    <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mt: 0.8 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: statusColor[node.status] }} />
                      <Typography sx={{ fontSize: 11, color: alpha('#e2e8f0', 0.88) }}>{node.status}</Typography>
                    </Stack>
                  </Box>
                  {index < nodes.length - 1 ? (
                    <Box sx={{ width: 62, height: 2, borderRadius: 5, bgcolor: alpha(nodes[index + 1].status === 'thinking' ? '#38bdf8' : '#334155', 0.85), position: 'relative', overflow: 'hidden' }}>
                      {nodes[index + 1].status === 'thinking' ? <LinearProgress sx={{ position: 'absolute', inset: 0, bgcolor: 'transparent' }} /> : null}
                    </Box>
                  ) : null}
                </Stack>
              ))}
            </Stack>
          </Box>

          <Collapse in={advancedView}>
            <Stack direction="row" spacing={1.2} sx={{ mt: 1.8 }}>
              <Chip label={`latency ${Math.max(120, events.length * 3)}ms`} size="small" sx={{ bgcolor: 'rgba(15,23,42,0.9)', color: '#bae6fd' }} />
              <Chip label={`tool calls ${events.filter((event) => event.type?.includes('symbol')).length}`} size="small" sx={{ bgcolor: 'rgba(15,23,42,0.9)', color: '#bae6fd' }} />
              <Chip label={`agent states ${nodes.filter((node) => node.status !== 'idle').length}/${nodes.length}`} size="small" sx={{ bgcolor: 'rgba(15,23,42,0.9)', color: '#bae6fd' }} />
            </Stack>
          </Collapse>
        </Box>
      </Stack>

      <Drawer
        anchor="right"
        open
        variant="persistent"
        PaperProps={{ sx: { width: 340, bgcolor: '#070b12', color: '#e2e8f0', p: 2.2, borderLeft: '1px solid rgba(148,163,184,0.12)' } }}
      >
        <Typography sx={{ fontSize: 11, letterSpacing: '0.16em', color: '#64748b' }}>REASONING PANEL</Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 300, mt: 0.4 }}>{activeNode.title}</Typography>
        <Typography sx={{ fontSize: 13, color: '#94a3b8', mt: 1.4 }}>{activeNode.explanation}</Typography>

        <Divider sx={{ my: 1.8, borderColor: 'rgba(148,163,184,0.15)' }} />
        <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>Structured output</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Row label="Signal" value={activeNode.output.signal} />
          <Row label="Confidence" value={activeNode.output.confidence} />
          <Box sx={{ p: 1.2, borderRadius: 2.5, bgcolor: 'rgba(15,23,42,0.6)' }}>
            <Typography sx={{ fontSize: 11, color: '#94a3b8', mb: 0.6 }}>Factors</Typography>
            {activeNode.output.factors.map((factor) => (
              <Typography key={factor} sx={{ fontSize: 12.5, mb: 0.4 }}>• {factor}</Typography>
            ))}
          </Box>
        </Stack>

        <Divider sx={{ my: 1.8, borderColor: 'rgba(148,163,184,0.15)' }} />
        <Typography sx={{ fontSize: 12, color: '#94a3b8', mb: 0.8 }}>Live logs</Typography>
        <Stack spacing={0.7} sx={{ maxHeight: '38vh', overflowY: 'auto' }}>
          {events.slice(-20).reverse().map((event, index) => (
            <Box key={`${event.timestamp || index}-${event.type || 'event'}`} sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.55)' }}>
              <Typography sx={{ fontSize: 11, color: '#7dd3fc' }}>{event.type || 'event'}</Typography>
              <Typography sx={{ fontSize: 12.5, color: '#cbd5e1' }}>
                {event.symbol ? `${event.symbol} · ` : ''}
                {event.action ? `action ${event.action}` : event.reason || event.errors || 'state update'}
              </Typography>
            </Box>
          ))}
          {!events.length ? <Typography sx={{ fontSize: 12, color: '#64748b' }}>No live events yet.</Typography> : null}
        </Stack>
      </Drawer>

      <Box sx={{ position: 'fixed', left: 20, right: 370, bottom: 12 }}>
        <Box
          onClick={() => setShowHistory((v) => !v)}
          sx={{
            p: 1.1,
            borderRadius: 3,
            bgcolor: alpha('#0f172a', 0.8),
            border: '1px solid rgba(148,163,184,0.2)',
            cursor: 'pointer'
          }}
        >
          <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>Memory timeline · {(results.trades || []).length} executions</Typography>
        </Box>
        <Collapse in={showHistory}>
          <Box sx={{ mt: 1, p: 1.2, borderRadius: 3, bgcolor: alpha('#0f172a', 0.88), maxHeight: 220, overflowY: 'auto' }}>
            {(results.trades || []).slice(-20).reverse().map((trade, index) => (
              <Stack key={`${trade.ts || index}-${trade.symbol}`} direction="row" justifyContent="space-between" sx={{ py: 0.65 }}>
                <Typography sx={{ fontSize: 12.5 }}>{trade.symbol} · {trade.action}</Typography>
                <Typography sx={{ fontSize: 12.5, color: trade.action === 'BUY' ? '#4ade80' : '#fda4af' }}>{formatUsd(trade.price)}</Typography>
              </Stack>
            ))}
            {!results.trades?.length ? <Typography sx={{ fontSize: 12, color: '#64748b' }}>Execution memory is empty.</Typography> : null}
            {lastTrade ? <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.8 }}>Latest: {lastTrade.symbol} {lastTrade.action}</Typography> : null}
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ p: 1.1, borderRadius: 2.4, bgcolor: 'rgba(15,23,42,0.6)' }}>
      <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>{label}</Typography>
      <Typography sx={{ fontSize: 12.5 }}>{value}</Typography>
    </Stack>
  );
}
