import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography
} from '@mui/material';

const activity = [
  { label: 'Edge sync complete', time: '2m ago' },
  { label: 'Inventory update queued', time: '18m ago' },
  { label: 'New support ticket', time: '1h ago' }
];

const metrics = [
  { label: 'Active devices', value: '1,284', change: '+6%' },
  { label: 'Offline-ready tasks', value: '97%', change: '+2%' },
  { label: 'Weekly uptime', value: '99.98%', change: '+0.04%' }
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
                Offline-first operations
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                Nimbus Ops Dashboard
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 520 }}>
                Monitor fleet health, sync status, and mission-critical tasks even when
                connectivity drops. Lightweight, professional, and ready for the field.
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" color="inherit">
                Export report
              </Button>
              <Button variant="contained">Create mission</Button>
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            {metrics.map((metric) => (
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
                      color="success"
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
                  <Typography variant="h6" fontWeight={600}>
                    Live readiness
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Edge nodes are synced locally with the latest mission plans and offline
                    procedures.
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 3 }}>
                    {['Data packs cached', 'Incident playbooks', 'Battery reserves'].map(
                      (item) => (
                        <Stack direction="row" spacing={2} alignItems="center" key={item}>
                          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                            ✓
                          </Avatar>
                          <Typography>{item}</Typography>
                        </Stack>
                      )
                    )}
                  </Stack>
                  <Button variant="text" sx={{ mt: 3 }}>
                    Review offline checklist
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={5}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600}>
                    Recent activity
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    {activity.map((item) => (
                      <Stack
                        key={item.label}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography>{item.label}</Typography>
                        <Typography color="text.secondary" variant="caption">
                          {item.time}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button variant="outlined" color="inherit" fullWidth sx={{ mt: 3 }}>
                    View all events
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
