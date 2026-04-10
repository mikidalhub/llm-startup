import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Box, Card, CardContent, Container, Typography } from '@mui/material';

export default async function ReadmePage() {
  const readmePath = path.join(process.cwd(), 'README.md');
  const content = await fs.readFile(readmePath, 'utf-8');

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
            Project README
          </Typography>
          <Box
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 13,
              lineHeight: 1.5
            }}
          >
            {content}
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
