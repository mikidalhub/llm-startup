const OPENAPI_VERSION = '3.1.0';

export const API_DOCS = {
  openapi: OPENAPI_VERSION,
  info: {
    title: 'Value-Driven Trading Advisor API',
    version: '1.0.0',
    description: 'Operational API for automated trading, portfolio visibility, and historical analytics.'
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'System', description: 'Health and service metadata' },
    { name: 'Trading', description: 'Trading lifecycle triggers and runtime state' },
    { name: 'Analytics', description: 'Portfolio, trades, and signals' },
    { name: 'Stocks', description: 'Tracked stock catalog and details' }
  ],
  paths: {
    '/api/health': { get: { tags: ['System'], summary: 'Health check' } },
    '/api/docs': { get: { tags: ['System'], summary: 'OpenAPI document (JSON)' } },
    '/api/state': { get: { tags: ['Trading'], summary: 'Current engine state' } },
    '/api/process/start': { post: { tags: ['Trading'], summary: 'Manually trigger trading tick' } },
    '/api/bootstrap': { get: { tags: ['Trading'], summary: 'Redis-first bootstrap payload' } },
    '/api/results': { get: { tags: ['Analytics'], summary: 'Latest persisted results payload' } },
    '/api/trades': {
      get: {
        tags: ['Analytics'],
        summary: 'Trades list',
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Filter by trade date (YYYY-MM-DD)' }
        ]
      }
    },
    '/api/decisions': { get: { tags: ['Analytics'], summary: 'Recent model decisions' } },
    '/api/signals': { get: { tags: ['Analytics'], summary: 'Latest signals by symbol' } },
    '/api/stocks': { get: { tags: ['Stocks'], summary: 'Tracked stocks with summary details' } },
    '/api/stocks/{symbol}': {
      get: {
        tags: ['Stocks'],
        summary: 'Single stock detail',
        parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }]
      }
    }
  }
};
