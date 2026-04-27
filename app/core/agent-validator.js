const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const sanitizeWarnings = (warnings) => {
  if (!Array.isArray(warnings)) return [];
  return warnings.map((warning) => String(warning || '').trim()).filter(Boolean);
};

export const createAgentFallback = (agentName, reason = 'Malformed agent output') => ({
  name: agentName,
  confidence: 0,
  data: {},
  warnings: [reason]
});

export const validateAgentOutput = (agentName, output) => {
  if (!output || typeof output !== 'object') {
    return createAgentFallback(agentName, 'Agent output missing or non-object.');
  }

  const resolvedName = String(output.name || agentName || 'unknown-agent').trim() || 'unknown-agent';
  const parsedConfidence = Number(output.confidence);
  const confidence = Number.isFinite(parsedConfidence) ? clamp(parsedConfidence, 0, 1) : 0;
  const data = output.data && typeof output.data === 'object' ? output.data : {};
  const warnings = sanitizeWarnings(output.warnings);

  return {
    name: resolvedName,
    confidence,
    data,
    ...(warnings.length ? { warnings } : {})
  };
};
