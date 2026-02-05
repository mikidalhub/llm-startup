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

export default function HomePage() {
  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 4, md: 8 }, bgcolor: 'background.default' }}>
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
                Professional trading decision flow
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                Apex Decision Workspace
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 560 }}>
                Build a repeatable, high-conviction trading plan in minutes. Scan markets,
                validate signals, approve risk, and publish execution details in a single,
                self-explanatory flow.
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" color="inherit">
                Simulate
              </Button>
              <Button variant="contained">Publish playbook</Button>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            {insights.map((metric) => (
              <Grid item xs={12} md={4} key={metric.label}>
                <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
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
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
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
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
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
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
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
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
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
