export const createGraphEventEmitter = (emitEvent) => (event) => {
  if (!event) return;
  const type = event.type || 'GRAPH_EVENT';
  const payload = {
    node: event.node,
    status: event.status,
    payload: event.payload,
    timestamp: event.timestamp
  };
  emitEvent(type, payload);
};
