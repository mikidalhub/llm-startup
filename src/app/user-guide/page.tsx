import { Card, CardContent, Container, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';

const steps = [
  {
    title: '1) Start Process',
    details: 'Click "Start Process" on the home page to run the complete pipeline from bean-start to trade decision.'
  },
  {
    title: '2) Watch active phase',
    details: 'The wheel highlights the current active phase and shows progress through data fetch, analysis, and trade execution.'
  },
  {
    title: '3) Review Dashboard',
    details: 'Check account value, cash, day P&L, and open positions after the process completes.'
  },
  {
    title: '4) Explore watchlist and KPIs',
    details: 'Use tabs to inspect trade candidates, risk labels, and KPI targets for quality control.'
  },
  {
    title: '5) Learn and verify',
    details: 'Open Learn tab and README route to understand strategy assumptions, architecture, and deployment options.'
  }
];

export default function UserGuidePage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h4" fontWeight={700}>
              User Guide
            </Typography>
            <Typography color="text.secondary">
              This platform combines free Yahoo market data with automated analysis modules and trading execution logic.
              Use this guide to understand exactly what you can do from the UI.
            </Typography>
            <List>
              {steps.map((step) => (
                <ListItem key={step.title} disableGutters>
                  <ListItemText primary={step.title} secondary={step.details} />
                </ListItem>
              ))}
            </List>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
