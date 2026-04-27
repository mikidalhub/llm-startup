import { runNode, runParallelGroup } from '../graph/mini-graph.js';
import { runDataNode } from '../nodes/data-node.js';
import { runTechnicalAgent } from '../agents/technical-agent.js';
import { runFundamentalAgent } from '../agents/fundamental-agent.js';
import { runSentimentAgent } from '../agents/sentiment-agent.js';
import { runRiskAgent } from '../agents/risk-agent.js';
import { runAggregatorNode } from '../nodes/aggregator-node.js';
import { runInvestmentThesisNode } from '../nodes/investment-thesis-node.js';
import { runRiskNode } from '../nodes/risk-node.js';
import { runExecutionNode } from '../nodes/execution-node.js';
import { validateAgentOutput } from '../app/core/agent-validator.js';

export const runTradingGraph = async ({ state, emit, context }) => {
  state.agentTrace = Array.isArray(state.agentTrace) ? state.agentTrace : [];
  await runNode({ node: 'DATA', state, emit, fn: runDataNode });

  const fanOutResults = await runParallelGroup({
    state,
    emit,
    nodes: [
      { node: 'TECHNICAL_AGENT', fn: runTechnicalAgent },
      { node: 'FUNDAMENTAL_AGENT', fn: runFundamentalAgent },
      { node: 'SENTIMENT_AGENT', fn: runSentimentAgent },
      { node: 'RISK_AGENT', fn: runRiskAgent }
    ]
  });

  const getValidated = (node, fallbackName) => {
    const rawOutput = fanOutResults.find((item) => item.node === node)?.result ?? null;
    const validated = validateAgentOutput(fallbackName, rawOutput);
    state.agentTrace.push({ agent: fallbackName, output: validated });
    return validated;
  };

  state.agentOutputs = {
    technical: getValidated('TECHNICAL_AGENT', 'technical-agent'),
    fundamental: getValidated('FUNDAMENTAL_AGENT', 'fundamental-agent'),
    sentiment: getValidated('SENTIMENT_AGENT', 'sentiment-agent'),
    risk: getValidated('RISK_AGENT', 'risk-agent')
  };

  state.investmentThesis = await runNode({
    node: 'INVESTMENT_THESIS',
    state,
    emit,
    fn: runInvestmentThesisNode
  });

  state.aggregatedDecision = await runNode({
    node: 'AGGREGATOR',
    state,
    emit,
    fn: (currentState, graphEmit) => runAggregatorNode(currentState, graphEmit, context)
  });

  state.riskDecision = await runNode({
    node: 'RISK',
    state,
    emit,
    fn: (currentState, graphEmit) => runRiskNode(currentState, graphEmit, context)
  });

  state.execution = await runNode({
    node: 'EXECUTION',
    state,
    emit,
    fn: (currentState, graphEmit) => runExecutionNode(currentState, graphEmit, context)
  });

  return state;
};
