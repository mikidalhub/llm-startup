'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography
} from '@mui/material';

const decisionSteps = [
  { title: 'Market Scan', detail: 'Macro + liquidity pulse' },
  { title: 'Signal Validation', detail: 'Confirm momentum and value' },
  { title: 'Risk Gate', detail: 'Drawdown + exposure limits' },
  { title: 'Execution Plan', detail: 'Order orchestration + hedges' }
];

const insights = [
  { label: 'Signal confidence', value: '82%', change: '+6%' },
  { label: 'Risk utilization', value: '41%', change: '-3%' },
  { label: 'Liquidity score', value: 'A-', change: '+1' }
];

const symbolDetails: Record<string, string> = {
  AAPL: 'Apple · NASDAQ',
  MSFT: 'Microsoft · NASDAQ',
  TSLA: 'Tesla · NASDAQ'
};

type StreamMode = 'connecting' | 'live' | 'fallback';

type ProcessEventPayload = {
  message?: string;
  type?: string;
};

type TradingRow = {
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: string;
};

type FeedEvent = {
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  at: string;
};

const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? 'local';

const glassCardSx = {
  position: 'relative',
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'rgba(148, 163, 184, 0.3)',
  bgcolor: 'rgba(255, 255, 255, 0.22)',
  backgroundImage:
    'linear-gradient(120deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.12) 32%, rgba(148,163,184,0.08) 100%)',
  backdropFilter: 'blur(20px) saturate(150%)',
  WebkitBackdropFilter: 'blur(20px) saturate(150%)',
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.2), inset 0 1px 0 rgba(255,255,255,0.45)',
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    borderRadius: 'inherit',
    background: 'radial-gradient(circle at top right, rgba(125,211,252,0.3), transparent 40%)'
  }
};

const toneColorMap: Record<FeedEvent['tone'], 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error'
};

const getBasePath = () => {
  const explicit = process.env.NEXT_PUBLIC_BASE_PATH;
  if (explicit) {
    return explicit.startsWith('/') ? explicit : `/${explicit}`;
  }

  if (typeof window === 'undefined') return '';

  const [firstSegment] = window.location.pathname.split('/').filter(Boolean);
  if (!firstSegment) return '';
  if (firstSegment.includes('.') || firstSegment.toLowerCase() === 'api') return '';
  return `/${firstSegment}`;
};

const getApiBaseUrl = () => {
  const explicitOrigin = process.env.NEXT_PUBLIC_API_ORIGIN?.trim();
  if (explicitOrigin) return explicitOrigin.replace(/\/+$/, '');

  const basePath = getBasePath();
  if (typeof window === 'undefined') return basePath;
  return `${window.location.origin}${basePath}`;
};

const getApiUrl = (baseUrl: string, path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

export default function HomePage() {
  const [activeWheelStep, setActiveWheelStep] = useState(0);
  const [eventMessage, setEventMessage] = useState('Bootstrapping autonomous pipeline...');
  const [eventFeed, setEventFeed] = useState<FeedEvent[]>([]);
  const [currentTrades, setCurrentTrades] = useState<TradingRow[]>([]);
  const [streamMode, setStreamMode] = useState<StreamMode>('connecting');
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const pushEvent = (message: string, tone: FeedEvent['tone']) => {
    setEventFeed((prev) => [{ message, tone, at: new Date().toISOString() }, ...prev].slice(0, 6));
  };

  useEffect(() => {
    const fallbackMessages = [
      { message: 'Ingestion handler synced 128 fresh market ticks.', tone: 'info' as const },
      { message: 'Signal validation approved discounted opportunities.', tone: 'success' as const },
      { message: 'Risk gate passed with CVaR and drawdown constraints.', tone: 'warning' as const },
      { message: 'Execution queue prepared with position sizing guardrails.', tone: 'info' as const }
    ];

    const inferStepFromMessage = (message: string) => {
      const text = message.toLowerCase();
      if (text.includes('ingest') || text.includes('market tick') || text.includes('stream')) return 0;
      if (text.includes('value') || text.includes('screen') || text.includes('signal')) return 1;
      if (text.includes('risk') || text.includes('drawdown') || text.includes('cvar')) return 2;
      if (text.includes('execution') || text.includes('order') || text.includes('trade')) return 3;
      return null;
    };

    const inferToneFromPayload = (payload: ProcessEventPayload, message: string): FeedEvent['tone'] => {
      const type = payload.type?.toLowerCase() ?? '';
      const text = message.toLowerCase();
      if (type.includes('error') || text.includes('error') || text.includes('fail')) return 'error';
      if (type.includes('warning') || text.includes('risk')) return 'warning';
      if (type.includes('success') || text.includes('passed') || text.includes('approved')) return 'success';
      return 'info';
    };

    const updateFromProcessEvent = (raw: ProcessEventPayload) => {
      const incoming = raw?.message ?? raw?.type ?? 'Pipeline event received';
      const tone = inferToneFromPayload(raw, incoming);
      setEventMessage(incoming);
      setLastEventAt(new Date().toISOString());
      pushEvent(incoming, tone);
      const inferred = inferStepFromMessage(incoming);
      if (inferred !== null) {
        setActiveWheelStep(inferred);
      } else {
        setActiveWheelStep((prev) => (prev + 1) % decisionSteps.length);
      }
    };

    const runFallbackTicker = () => {
      return window.setInterval(() => {
        setActiveWheelStep((prev) => {
          const nextIndex = (prev + 1) % decisionSteps.length;
          const nextMessage = fallbackMessages[nextIndex] ?? fallbackMessages[0];
          setEventMessage(nextMessage.message);
          setLastEventAt(new Date().toISOString());
          pushEvent(nextMessage.message, nextMessage.tone);
          return nextIndex;
        });
      }, 3000);
    };

    let fallbackInterval: number | null = null;
    let eventSource: EventSource | null = null;

    const forceLive = new URLSearchParams(window.location.search).get('live') === '1';
    const hasExplicitApiOrigin = Boolean(process.env.NEXT_PUBLIC_API_ORIGIN);
    const shouldUseFallbackOnly = window.location.hostname.endsWith('github.io') && !forceLive && !hasExplicitApiOrigin;

    if (shouldUseFallbackOnly) {
      setStreamMode('fallback');
      fallbackInterval = runFallbackTicker();
    } else {
      try {
        eventSource = new EventSource(getApiUrl(apiBaseUrl, '/events'));
        eventSource.onopen = () => {
          setStreamMode('live');
          setEventMessage('Connected to backend event stream.');
          pushEvent('Connected to backend event stream.', 'success');
        };
        eventSource.addEventListener('process', (event) => {
          const parsed = JSON.parse((event as MessageEvent<string>).data) as ProcessEventPayload;
          updateFromProcessEvent(parsed);
        });
        eventSource.onerror = () => {
          eventSource?.close();
          setStreamMode('fallback');
          pushEvent('Lost server connection. Fallback mode enabled.', 'warning');
          if (!fallbackInterval) fallbackInterval = runFallbackTicker();
        };
      } catch {
        setStreamMode('fallback');
        pushEvent('Unable to connect to server stream. Fallback mode enabled.', 'warning');
        fallbackInterval = runFallbackTicker();
      }
    }

    return () => {
      if (fallbackInterval) window.clearInterval(fallbackInterval);
      eventSource?.close();
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    const abortController = new AbortController();

    const loadTrades = async () => {
      const fallbackTrades: TradingRow[] = [
        { symbol: 'AAPL', side: 'BUY', quantity: 22, price: 198.41, timestamp: new Date().toISOString() },
        {
          symbol: 'MSFT',
          side: 'BUY',
          quantity: 11,
          price: 427.8,
          timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString()
        },
        {
          symbol: 'TSLA',
          side: 'SELL',
          quantity: 9,
          price: 171.62,
          timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString()
        }
      ];

      try {
        const response = await fetch(getApiUrl(apiBaseUrl, '/api/trades'), { signal: abortController.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as Partial<TradingRow>[];
        const normalized = data
          .map((trade) => ({
            symbol: trade.symbol ?? 'N/A',
            side: (trade.side ?? 'BUY').toUpperCase(),
            quantity: Number(trade.quantity ?? 0),
            price: Number(trade.price ?? 0),
            timestamp: trade.timestamp ?? new Date().toISOString()
          }))
          .slice(-3)
          .reverse();

        setCurrentTrades(normalized.length > 0 ? normalized : fallbackTrades);
      } catch {
        setCurrentTrades(fallbackTrades);
      }
    };

    void loadTrades();

    return () => {
      abortController.abort();
    };
  }, [apiBaseUrl]);

  const wheelNodes = useMemo(
    () => [
      { top: '10%', left: '50%' },
      { top: '50%', left: '90%' },
      { top: '90%', left: '50%' },
      { top: '50%', left: '10%' }
    ],
    []
  );

  const wheelProgress = ((activeWheelStep + 1) / decisionSteps.length) * 100;
  const wheelAngle = -90 + (wheelProgress / 100) * 360;

  const triggerProcessTick = async () => {
    try {
      const response = await fetch(getApiUrl(apiBaseUrl, '/api/process/start'), { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setEventMessage('Manual backend tick requested.');
      pushEvent('Manual backend tick requested.', 'info');
    } catch {
      setEventMessage('Unable to trigger backend tick from this environment.');
      pushEvent('Unable to trigger backend tick from this environment.', 'error');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 2, md: 3 },
        bgcolor: 'background.default',
        backgroundImage:
          'radial-gradient(circle at 15% 20%, rgba(56,189,248,0.28), transparent 45%), radial-gradient(circle at 80% 10%, rgba(167,139,250,0.26), transparent 42%), linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #334155 100%)'
      }}
    >
      <Container maxWidth="xl">
        <Stack spacing={2.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5}>
            <Box>
              <Typography variant="overline" sx={{ color: 'rgba(226, 232, 240, 0.9)' }}>
                Realtime autonomous trading operations
              </Typography>
              <Typography variant="h4" fontWeight={700} sx={{ color: '#f8fafc' }}>
                Live Trading Control Center
              </Typography>
              <Typography sx={{ mt: 0.5, color: 'rgba(226, 232, 240, 0.85)' }}>
                Key status only: wheel position, risk posture, live events, and latest fills.
              </Typography>
              <Typography sx={{ mt: 0.5, color: 'rgba(186, 230, 253, 0.95)' }}>
                Backend endpoint: <strong>{apiBaseUrl || '(same-origin root)'}</strong>
              </Typography>
            </Box>
            <Chip label={`Build ${buildSha}`} size="small" sx={{ color: '#e2e8f0', borderColor: 'rgba(226,232,240,0.4)' }} variant="outlined" />
          </Stack>

          <Grid container spacing={2.5}>
            <Grid item xs={12} md={7}>
              <Card elevation={0} sx={glassCardSx}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6" fontWeight={700}>
                        Process wheel (always visible)
                      </Typography>
                      <Button variant="outlined" size="small" onClick={triggerProcessTick}>
                        Trigger tick
                      </Button>
                    </Stack>
                    <Typography color="text.secondary">
                      Current stage: <strong>{decisionSteps[activeWheelStep]?.title}</strong> · {eventMessage}
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                      <Box
                        sx={{
                          position: 'relative',
                          width: { xs: 260, md: 310 },
                          height: { xs: 260, md: 310 },
                          borderRadius: '50%',
                          border: '1px solid rgba(148, 163, 184, 0.4)',
                          bgcolor: 'rgba(15, 23, 42, 0.25)',
                          transition: 'all 600ms cubic-bezier(0.22, 1, 0.36, 1)'
                        }}
                      >
                        <CircularProgress
                          variant="determinate"
                          value={100}
                          size="100%"
                          thickness={1.7}
                          sx={{ position: 'absolute', inset: 0, color: 'rgba(148, 163, 184, 0.38)' }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: { xs: 12, md: 14 },
                            borderRadius: '50%',
                            background: `conic-gradient(from -90deg, rgba(56, 189, 248, 0.95) 0deg, rgba(56, 189, 248, 0.95) ${
                              (wheelProgress / 100) * 360
                            }deg, transparent ${(wheelProgress / 100) * 360}deg, transparent 360deg)`,
                            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 8px))',
                            mask: 'radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 8px))',
                            transition: 'all 600ms cubic-bezier(0.22, 1, 0.36, 1)'
                          }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: { xs: 236, md: 282 },
                            height: { xs: 236, md: 282 },
                            transform: `translate(-50%, -50%) rotate(${wheelAngle}deg)`,
                            transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
                            pointerEvents: 'none'
                          }}
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: '#38bdf8',
                              boxShadow: '0 0 0 5px rgba(56,189,248,.18)'
                            }}
                          />
                        </Box>

                        {wheelNodes.map((node, idx) => (
                          <Box
                            key={`wheel-anchor-${idx}`}
                            sx={{
                              position: 'absolute',
                              top: node.top,
                              left: node.left,
                              transform: 'translate(-50%, -50%)',
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              border: '2px solid rgba(148, 163, 184, 0.65)',
                              bgcolor: 'rgba(255,255,255,0.72)'
                            }}
                          />
                        ))}

                        {decisionSteps.map((step, idx) => (
                          <Box
                            key={step.title}
                            sx={{
                              position: 'absolute',
                              top: wheelNodes[idx].top,
                              left: wheelNodes[idx].left,
                              transform: 'translate(-50%, -50%)',
                              textAlign: 'center',
                              width: 112
                            }}
                          >
                            <Avatar
                              sx={{
                                mx: 'auto',
                                mb: 0.8,
                                width: 36,
                                height: 36,
                                bgcolor: activeWheelStep === idx ? 'primary.main' : 'rgba(148, 163, 184, 0.8)',
                                color: activeWheelStep === idx ? 'primary.contrastText' : '#0f172a',
                                boxShadow: activeWheelStep === idx ? '0 0 0 8px rgba(56,189,248,.22)' : 'none',
                                transform: activeWheelStep === idx ? 'scale(1.08)' : 'scale(1)',
                                transition: 'all 650ms cubic-bezier(0.22, 1, 0.36, 1)'
                              }}
                            >
                              {idx + 1}
                            </Avatar>
                            <Typography variant="caption" fontWeight={600}>
                              {step.title}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                              {step.detail}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={5}>
              <Stack spacing={2.5}>
                <Card elevation={0} sx={glassCardSx}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="h6" fontWeight={700}>
                        Live status
                      </Typography>
                      <Chip color={streamMode === 'live' ? 'success' : streamMode === 'connecting' ? 'warning' : 'default'} label={`Stream: ${streamMode}`} />
                    </Stack>
                    {lastEventAt ? (
                      <Typography variant="caption" color="text.secondary">
                        Last message at {new Date(lastEventAt).toLocaleTimeString('en-US', { hour12: false })}
                      </Typography>
                    ) : null}
                    <Stack spacing={1} sx={{ mt: 1.5 }}>
                      {eventFeed.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Waiting for server events...
                        </Typography>
                      ) : (
                        eventFeed.map((event) => (
                          <Stack key={`${event.at}-${event.message}`} direction="row" spacing={1} alignItems="center" sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(248,250,252,0.55)' }}>
                            <Chip size="small" label={event.tone} color={toneColorMap[event.tone]} sx={{ textTransform: 'capitalize', minWidth: 72 }} />
                            <Typography variant="body2" sx={{ flex: 1 }}>
                              {event.message}
                            </Typography>
                          </Stack>
                        ))
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
            <Grid item xs={12}>
              <Card elevation={0} sx={glassCardSx}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700}>
                    Latest fills
                  </Typography>
                  <Grid container spacing={1.2} sx={{ mt: 0.5 }}>
                    {currentTrades.map((trade) => (
                      <Grid item xs={12} sm={4} key={`${trade.symbol}-${trade.timestamp}`}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{ px: 1.5, py: 1.1, borderRadius: 2, bgcolor: 'rgba(248,250,252,0.58)' }}
                        >
                          <Box>
                            <Typography fontWeight={600}>{trade.symbol}</Typography>
                            <Typography variant="caption" sx={{ display: 'block', color: 'rgba(100, 116, 139, 0.95)' }}>
                              {symbolDetails[trade.symbol] ?? 'US Equity · Live feed'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(trade.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })}{' '}
                              UTC
                            </Typography>
                          </Box>
                          <Stack alignItems="flex-end" spacing={0.4}>
                            <Chip size="small" label={`${trade.side} ${trade.quantity}`} color={trade.side === 'SELL' ? 'error' : 'success'} />
                            <Typography variant="body2" fontWeight={700}>
                              ${trade.price.toFixed(2)}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card
                elevation={0}
                sx={{
                  ...glassCardSx,
                  borderColor: 'rgba(56, 189, 248, 0.34)',
                  boxShadow: '0 20px 50px rgba(2, 132, 199, 0.2), inset 0 1px 0 rgba(255,255,255,0.58)'
                }}
              >
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" fontWeight={700}>
                      At-a-glance metrics
                    </Typography>
                    <Chip label="Quick pulse" color="info" size="small" />
                  </Stack>
                  <Grid container spacing={1.2} sx={{ mt: 0.5 }}>
                    {insights.map((metric) => (
                      <Grid item xs={12} sm={4} key={metric.label}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: 'rgba(248,250,252,0.68)',
                            border: '1px solid rgba(125, 211, 252, 0.45)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)'
                          }}
                        >
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {metric.label}
                            </Typography>
                            <Typography variant="h5" fontWeight={800}>
                              {metric.value}
                            </Typography>
                          </Box>
                          <Chip label={metric.change} color={metric.change.startsWith('-') ? 'warning' : 'success'} size="small" />
                        </Stack>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
