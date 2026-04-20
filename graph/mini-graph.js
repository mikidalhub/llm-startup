const nowIso = () => new Date().toISOString();

export const createGraphEvent = ({ node, status, payload = {}, type = 'GRAPH_NODE' }) => ({
  type,
  node,
  status,
  payload,
  timestamp: nowIso()
});

const emitLifecycle = (emit, node, status, payload = {}, type = 'GRAPH_NODE') => {
  emit?.(createGraphEvent({ node, status, payload, type }));
};

export const runNode = async ({ node, state, emit, fn }) => {
  emitLifecycle(emit, node, 'START', { symbol: state.symbol });
  emitLifecycle(emit, node, 'PROCESSING', { symbol: state.symbol });
  const result = await fn(state, emit);
  emitLifecycle(emit, node, 'DONE', {
    symbol: state.symbol,
    keys: result && typeof result === 'object' ? Object.keys(result) : []
  });
  return result;
};

export const runParallelGroup = async ({ nodes, state, emit }) => {
  const settled = await Promise.all(nodes.map(async ({ node, fn }) => {
    try {
      const result = await runNode({ node, state, emit, fn });
      return { node, result, error: null };
    } catch (error) {
      emitLifecycle(emit, node, 'DONE', {
        symbol: state.symbol,
        error: error instanceof Error ? error.message : String(error)
      }, 'GRAPH_NODE_ERROR');
      return { node, result: null, error };
    }
  }));

  return settled;
};
