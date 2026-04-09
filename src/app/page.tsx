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
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography
} from '@mui/material';

const decisionSteps = [
  {
    title: 'Market Scan',
    detail: 'Macro, sector rotation, volatility regime',
    status: 'complete'
  },
  {
    title: 'Signal Validation',
    detail: 'Confirm momentum, mean reversion, liquidity',
    status: 'active'
  },
  {
    title: 'Risk Gate',
    detail: 'Position sizing, max drawdown, exposure caps',
    status: 'queued'
  },
  {
    title: 'Execution Plan',
    detail: 'Entry, stop, take-profit, hedge coverage',
    status: 'queued'
  }
];

const valueCards = [
  {
    title: 'Discipline first',
    value: 'Risk-capped entries',
    text: 'Every setup is validated against drawdown and exposure limits before it can move to execution.'
  },
  {
    title: 'Explainable decisions',
    value: 'Clear trade rationale',
    text: 'Signal evidence, risk constraints, and execution parameters are visible in one place.'
  },
  {
    title: 'Always-on process',
    value: 'Live operational wheel',
    text: 'The wheel continuously shows where the system is in the trade lifecycle and what comes next.'
  }
];

const insights = [
  { label: 'Signal confidence', value: '82%', change: '+6%' },
  { label: 'Risk utilization', value: '41%', change: '-3%' },
  { label: 'Liquidity score', value: 'A-', change: '+1' }
];

const activeStepIndex = decisionSteps.findIndex((step) => step.status === 'active');

const watchlist = [
  { symbol: 'EUR/USD', bias: 'Long', horizon: 'Swing' },
  { symbol: 'NQ100', bias: 'Neutral', horizon: 'Intraday' },
  { symbol: 'XAU/USD', bias: 'Short', horizon: 'Macro' }
];

const tradeTicket = [
  { label: 'Entry window', value: '14:30 - 15:10 UTC' },
  { label: 'Stop loss', value: '1.5 ATR / 0.8%' },
  { label: 'Take profit', value: '2.8 ATR / 1.6%' },
  { label: 'Position size', value: '0.7% NAV' }
];

const processHandlers = [
  { name: 'Ingestion Handler', state: 'streaming', throughput: '128 ticks/s', progress: 88 },
  { name: 'Strategy Handler', state: 'active', throughput: '36 eval/s', progress: 71 },
  { name: 'Risk Handler', state: 'guarding', throughput: '14 checks/s', progress: 93 },
  { name: 'Execution Handler', state: 'queued', throughput: 'Awaiting trigger', progress: 42 }
];

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

const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? 'local';

const glassCardSx = {
  border: '1px solid',
  borderColor: 'rgba(148, 163, 184, 0.26)',
  bgcolor: 'rgba(255, 255, 255, 0.58)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  boxShadow: '0 20px 45px rgba(148, 163, 184, 0.16)'
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

export default function HomePage() {
  const [activeWheelStep, setActiveWheelStep] = useState(0);
  const [eventMessage, setEventMessage] = useState('Bootstrapping autonomous pipeline...');
  const [currentTrades, setCurrentTrades] = useState<TradingRow[]>([]);
  const [streamMode, setStreamMode] = useState<'connecting' | 'live' | 'fallback'>('connecting');
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  useEffect(() => {
    const fallbackMessages = [
      'Ingestion handler synced 128 fresh market ticks.',
      'Value engine found 3 discounted opportunities.',
      'Risk gate passed with CVaR and max-drawdown constraints.',
      'Execution queue prepared with position sizing guardrails.'
    ];

    const runFallbackTicker = () => {
      return window.setInterval(() => {
        setActiveWheelStep((prev) => (prev + 1) % decisionSteps.length);
        setEventMessage((prev) => {
          const idx = fallbackMessages.indexOf(prev);
          return fallbackMessages[(idx + 1) % fallbackMessages.length] ?? fallbackMessages[0];
        });
      }, 3000);
    };

    const inferStepFromMessage = (message: string) => {
      const text = message.toLowerCase();
      if (text.includes('ingest') || text.includes('market tick') || text.includes('stream')) return 0;
      if (text.includes('value') || text.includes('screen') || text.includes('signal')) return 1;
      if (text.includes('risk') || text.includes('drawdown') || text.includes('cvar')) return 2;
      if (text.includes('execution') || text.includes('order') || text.includes('trade')) return 3;
      return null;
    };

    const updateFromProcessEvent = (raw: ProcessEventPayload) => {
      const incoming = raw?.message ?? raw?.type ?? 'Pipeline event received';
      setEventMessage(incoming);
      setLastEventAt(new Date().toISOString());
      const inferred = inferStepFromMessage(incoming);
      if (inferred !== null) {
        setActiveWheelStep(inferred);
      } else {
        setActiveWheelStep((prev) => (prev + 1) % decisionSteps.length);
      }
    };

    let fallbackInterval: number | null = null;
    let eventSource: EventSource | null = null;

    const forceLive = new URLSearchParams(window.location.search).get('live') === '1';
    const shouldUseFallbackOnly = window.location.hostname.endsWith('github.io') && !forceLive;

    if (shouldUseFallbackOnly) {
      setStreamMode('fallback');
      fallbackInterval = runFallbackTicker();
    } else {
      try {
        const basePath = getBasePath();
        eventSource = new EventSource(`${basePath}/events`);
        eventSource.onopen = () => {
          setStreamMode('live');
          setEventMessage('Connected to backend event stream.');
        };
        eventSource.addEventListener('process', (event) => {
          const parsed = JSON.parse((event as MessageEvent<string>).data) as ProcessEventPayload;
          updateFromProcessEvent(parsed);
        });
        eventSource.onerror = () => {
          eventSource?.close();
          setStreamMode('fallback');
          if (!fallbackInterval) fallbackInterval = runFallbackTicker();
        };
      } catch {
        setStreamMode('fallback');
        fallbackInterval = runFallbackTicker();
      }
    }

    return () => {
      if (fallbackInterval) window.clearInterval(fallbackInterval);
      eventSource?.close();
    };
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    const loadTrades = async () => {
      const basePath = getBasePath();
      const fallbackTrades: TradingRow[] = [
        { symbol: 'AAPL', side: 'BUY', quantity: 22, price: 198.41, timestamp: new Date().toISOString() },
        { symbol: 'MSFT', side: 'BUY', quantity: 11, price: 427.8, timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
        { symbol: 'TSLA', side: 'SELL', quantity: 9, price: 171.62, timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString() }
      ];

      try {
        const response = await fetch(`${basePath}/api/trades`, { signal: abortController.signal });
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
          .slice(-5)
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
  }, []);

  const wheelNodes = useMemo(
    () => [
      { top: '10%', left: '50%' },
      { top: '50%', left: '90%' },
      { top: '90%', left: '50%' },
      { top: '50%', left: '10%' }
    ],
    []
  );

  const triggerProcessTick = async () => {
    const basePath = getBasePath();
    try {
      const response = await fetch(`${basePath}/api/process/start`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setEventMessage('Manual backend tick requested.');
    } catch {
      setEventMessage('Unable to trigger backend tick from this environment.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 4, md: 8 },
        bgcolor: 'background.default',
        backgroundImage:
          'radial-gradient(circle at 15% 20%, rgba(148,163,184,0.35), transparent 45%), radial-gradient(circle at 85% 15%, rgba(191,219,254,0.45), transparent 42%), linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)'
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={4}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
          >
            <Box>
              <Typography variant="overline" color="primary.main">
                Autonomous live trading process
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                Trade WHEEL AI cockpit
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 560 }}>
                Scan markets, validate values, pass risk gates, and execute with a moving wheel that
                shows where your process is right now.
              </Typography>
              <Chip
                label={`Build ${buildSha}`}
                size="small"
                variant="outlined"
                sx={{ mt: 2, borderColor: 'rgba(100, 116, 139, 0.4)' }}
              />
            </Box>
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" color="inherit">
                Simulate
              </Button>
              <Button variant="contained">Publish playbook</Button>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            {valueCards.map((card) => (
              <Grid item xs={12} md={4} key={card.title}>
                <Card elevation={0} sx={glassCardSx}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">
                      {card.title}
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 1 }} fontWeight={700}>
                      {card.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                      {card.text}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card elevation={0} sx={glassCardSx}>
            <CardContent>
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  spacing={1.5}
                >
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      Continuous flow process handler
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Event-driven pipeline running in real time with graceful fallback on static hosting.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      color={streamMode === 'live' ? 'success' : streamMode === 'connecting' ? 'warning' : 'default'}
                      label={`Stream: ${streamMode}`}
                    />
                    <Button variant="outlined" size="small" onClick={triggerProcessTick}>
                      Test backend tick
                    </Button>
                  </Stack>
                </Stack>
                {lastEventAt ? (
                  <Typography variant="caption" color="text.secondary">
                    Last backend message: {new Date(lastEventAt).toLocaleTimeString('en-US', { hour12: false })}
                  </Typography>
                ) : null}

                <Box
                  sx={{
                    height: 6,
                    borderRadius: 999,
                    overflow: 'hidden',
                    position: 'relative',
                    bgcolor: 'rgba(148, 163, 184, 0.24)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(90deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.95) 48%, rgba(125,211,252,0.9) 100%)',
                      animation: 'flowWave 2.4s linear infinite',
                      transformOrigin: 'left center'
                    },
                    '@keyframes flowWave': {
                      '0%': { transform: 'translateX(-45%) scaleX(0.8)' },
                      '100%': { transform: 'translateX(110%) scaleX(1.05)' }
                    }
                  }}
                />

                <Grid container spacing={2}>
                  {processHandlers.map((handler) => (
                    <Grid item xs={12} md={6} key={handler.name}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid rgba(148, 163, 184, 0.24)',
                          bgcolor: 'rgba(248, 250, 252, 0.72)'
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography fontWeight={600}>{handler.name}</Typography>
                          <Chip
                            size="small"
                            label={handler.state}
                            color={handler.state === 'queued' ? 'default' : 'primary'}
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {handler.throughput}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={handler.progress}
                          sx={{
                            mt: 1.5,
                            height: 8,
                            borderRadius: 999,
                            bgcolor: 'rgba(148, 163, 184, 0.2)',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 999,
                              background:
                                'linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(56,189,248,0.95) 100%)'
                            }
                          }}
                        />
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={3}>
            {insights.map((metric) => (
              <Grid item xs={12} md={4} key={metric.label}>
                <Card elevation={0} sx={glassCardSx}>
                  <CardContent>
                    <Typography color="text.secondary" variant="subtitle2">
                      {metric.label}
                    </Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
                      {metric.value}
                    </Typography>
                    <Chip
                      label={metric.change}
                      color={metric.change.startsWith('-') ? 'warning' : 'success'}
                      size="small"
                      sx={{ mt: 2 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
              <Card elevation={0} sx={glassCardSx}>
                <CardContent>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        Trade process wheel
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        Live wheel position: <strong>{decisionSteps[activeWheelStep]?.title}</strong>. {eventMessage}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        position: 'relative',
                        mx: 'auto',
                        width: { xs: 260, md: 320 },
                        height: { xs: 260, md: 320 },
                        borderRadius: '50%',
                        border: '1px solid rgba(100, 116, 139, 0.26)',
                        bgcolor: 'rgba(248, 250, 252, 0.6)'
                      }}
                    >
                      <CircularProgress
                        variant="determinate"
                        value={((activeWheelStep + 1) / decisionSteps.length) * 100}
                        size="100%"
                        thickness={1.8}
                        sx={{ position: 'absolute', inset: 0, color: 'primary.main' }}
                      />

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
                              bgcolor: activeWheelStep === idx ? 'primary.main' : 'grey.300',
                              color: activeWheelStep === idx ? 'primary.contrastText' : 'text.primary',
                              transition: 'all .25s ease',
                              boxShadow:
                                activeWheelStep === idx ? '0 0 0 6px rgba(59,130,246,.14)' : 'none'
                            }}
                          >
                            {idx + 1}
                          </Avatar>
                          <Typography variant="caption" fontWeight={600}>
                            {step.title}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    <Stepper
                      orientation="vertical"
                      activeStep={activeStepIndex}
                      sx={{ '& .MuiStepConnector-line': { minHeight: 24 } }}
                    >
                      {decisionSteps.map((step) => (
                        <Step key={step.title} completed={step.status === 'complete'}>
                          <StepLabel
                            optional={
                              <Typography variant="body2" color="text.secondary">
                                {step.detail}
                              </Typography>
                            }
                          >
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Typography fontWeight={600}>{step.title}</Typography>
                              <Chip
                                label={step.status}
                                color={step.status === 'active' ? 'primary' : 'default'}
                                size="small"
                              />
                            </Stack>
                          </StepLabel>
                        </Step>
                      ))}
                    </Stepper>
                    <Button variant="text">Open decision log</Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={5}>
              <Stack spacing={3}>
                <Card elevation={0} sx={glassCardSx}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={600}>
                      Trade ticket
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      Pre-approved execution details with risk and compliance checks.
                    </Typography>
                    <Stack spacing={2} sx={{ mt: 3 }}>
                      {tradeTicket.map((item) => (
                        <Stack
                          key={item.label}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography color="text.secondary">{item.label}</Typography>
                          <Typography fontWeight={600}>{item.value}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Divider sx={{ my: 3 }} />
                    <Button variant="contained" fullWidth>
                      Send to execution
                    </Button>
                  </CardContent>
                </Card>

                <Card elevation={0} sx={glassCardSx}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={600}>
                      Current tradings
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      Latest executed trades (live API when available, fallback otherwise).
                    </Typography>
                    <Stack spacing={1.5} sx={{ mt: 2.2 }}>
                      {currentTrades.map((trade) => (
                        <Stack
                          key={`${trade.symbol}-${trade.timestamp}`}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{
                            px: 1.5,
                            py: 1,
                            borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.65)',
                            border: '1px solid rgba(148, 163, 184, 0.18)'
                          }}
                        >
                          <Box>
                            <Typography fontWeight={600}>{trade.symbol}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(trade.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                                timeZone: 'UTC'
                              })}{' '}
                              UTC
                            </Typography>
                          </Box>
                          <Stack alignItems="flex-end" spacing={0.5}>
                            <Chip
                              size="small"
                              label={`${trade.side} ${trade.quantity}`}
                              color={trade.side === 'SELL' ? 'error' : 'success'}
                            />
                            <Typography variant="body2" fontWeight={600}>
                              ${trade.price.toFixed(2)}
                            </Typography>
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={glassCardSx}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600}>
                    Signal stack
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Combine quantitative signals with discretionary notes for clarity.
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 3 }}>
                    {[
                      'Momentum +2.4σ above 30-day mean',
                      'Order book imbalance favors buyers',
                      'Macro calendar clear for next 6h'
                    ].map((item) => (
                      <Stack direction="row" spacing={2} alignItems="center" key={item}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                          ✓
                        </Avatar>
                        <Typography>{item}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button variant="text" sx={{ mt: 3 }}>
                    Add signal evidence
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={glassCardSx}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600}>
                    Live watchlist
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Track key markets while the decision flow runs in parallel.
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 3 }}>
                    {watchlist.map((item) => (
                      <Stack
                        key={item.symbol}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Box>
                          <Typography fontWeight={600}>{item.symbol}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.horizon}
                          </Typography>
                        </Box>
                        <Chip
                          label={item.bias}
                          color={item.bias === 'Long' ? 'success' : item.bias === 'Short' ? 'error' : 'default'}
                          size="small"
                        />
                      </Stack>
                    ))}
                  </Stack>
                  <Button variant="outlined" color="inherit" fullWidth sx={{ mt: 3 }}>
                    Expand watchlist
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
