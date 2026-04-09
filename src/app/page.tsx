'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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

const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? 'local';

const glassCardSx = {
  border: '1px solid',
  borderColor: 'rgba(148, 163, 184, 0.24)',
  bgcolor: 'rgba(15, 23, 42, 0.52)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.28)'
};

export default function HomePage() {
  const [activeWheelStep, setActiveWheelStep] = useState(0);
  const [eventMessage, setEventMessage] = useState('Bootstrapping autonomous pipeline...');

  useEffect(() => {
    const fallbackMessages = [
      'Ingestion handler synced 128 fresh market ticks.',
      'Value engine found 3 discounted cashflow opportunities.',
      'Risk gate passed with CVaR and max-drawdown constraints.',
      'Execution queue prepared with position sizing guardrails.'
    ];

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
      const inferred = inferStepFromMessage(incoming);
      if (inferred !== null) {
        setActiveWheelStep(inferred);
      } else {
        setActiveWheelStep((prev) => (prev + 1) % decisionSteps.length);
      }
    };

    let fallbackInterval: number | null = null;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/events');
      eventSource.addEventListener('process', (event) => {
        const parsed = JSON.parse((event as MessageEvent<string>).data) as ProcessEventPayload;
        updateFromProcessEvent(parsed);
      });
      eventSource.onerror = () => {
        eventSource?.close();
        fallbackInterval = window.setInterval(() => {
          setActiveWheelStep((prev) => (prev + 1) % decisionSteps.length);
          setEventMessage((prev) => {
            const idx = fallbackMessages.indexOf(prev);
            return fallbackMessages[(idx + 1) % fallbackMessages.length] ?? fallbackMessages[0];
          });
        }, 3000);
      };
    } catch {
      fallbackInterval = window.setInterval(() => {
        setActiveWheelStep((prev) => (prev + 1) % decisionSteps.length);
        setEventMessage((prev) => {
          const idx = fallbackMessages.indexOf(prev);
          return fallbackMessages[(idx + 1) % fallbackMessages.length] ?? fallbackMessages[0];
        });
      }, 3000);
    }

    return () => {
      if (fallbackInterval) window.clearInterval(fallbackInterval);
      eventSource?.close();
    };
  }, []);

  const wheelNodes = useMemo(
    () => [
      { top: '8%', left: '50%' },
      { top: '50%', left: '92%' },
      { top: '92%', left: '50%' },
      { top: '50%', left: '8%' }
    ],
    []
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 4, md: 8 },
        bgcolor: 'background.default',
        backgroundImage:
          'radial-gradient(circle at 15% 20%, rgba(96,165,250,0.22), transparent 45%), radial-gradient(circle at 85% 15%, rgba(245,158,11,0.2), transparent 42%), linear-gradient(180deg, #0b0f14 0%, #0f172a 100%)'
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
              <Typography variant="overline" color="secondary.main">
                Autonomous live trading process
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                Trade by AI for you
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 560 }}>
                Build a repeatable, high-conviction trading plan in minutes. Scan markets,
                validate signals, approve risk, and publish execution details in a single,
                self-explanatory flow.
              </Typography>
              <Chip
                label={`Build ${buildSha}`}
                size="small"
                variant="outlined"
                sx={{ mt: 2, borderColor: 'rgba(148, 163, 184, 0.45)' }}
              />
            </Box>
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" color="inherit">
                Simulate
              </Button>
              <Button variant="contained">Publish playbook</Button>
            </Stack>
          </Stack>

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
                      Event-driven pipeline running in real time to make execution feel always-on.
                    </Typography>
                  </Box>
                  <Chip color="success" label="Realtime stream online" />
                </Stack>

                <Box
                  sx={{
                    height: 6,
                    borderRadius: 999,
                    overflow: 'hidden',
                    position: 'relative',
                    bgcolor: 'rgba(148, 163, 184, 0.2)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(90deg, rgba(96,165,250,0.18) 0%, rgba(96,165,250,0.95) 48%, rgba(245,158,11,0.9) 100%)',
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
                          border: '1px solid rgba(148, 163, 184, 0.22)',
                          bgcolor: 'rgba(15, 23, 42, 0.42)'
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
                                'linear-gradient(90deg, rgba(96,165,250,1) 0%, rgba(245,158,11,0.95) 100%)'
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
                        Decision flow
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        Each stage is time-stamped and auditable to keep execution fast,
                        consistent, and compliant.
                      </Typography>
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
