import { runNode, runParallelGroup } from '../graph/mini-graph.js';
import { runDataNode } from '../nodes/data-node.js';
import { runTechnicalAgent } from '../agents/technical-agent.js';
import { runFundamentalAgent } from '../agents/fundamental-agent.js';
import { runSentimentAgent } from '../agents/sentiment-agent.js';
import { runAggregatorNode } from '../nodes/aggregator-node.js';
import { runRiskNode } from '../nodes/risk-node.js';
import { runExecutionNode } from '../nodes/execution-node.js';

export const runTradingGraph = async ({ state, emit, context }) => {
  await runNode({ node: 'DATA', state, emit, fn: runDataNode });

  const fanOutResults = await runParallelGroup({
    state,
    emit,
    nodes: [
      { node: 'TECHNICAL_AGENT', fn: runTechnicalAgent },
      { node: 'FUNDAMENTAL_AGENT', fn: runFundamentalAgent },
      { node: 'SENTIMENT_AGENT', fn: runSentimentAgent }
    ]
  });

  state.agentOutputs = {
    technical: fanOutResults.find((item) => item.node === 'TECHNICAL_AGENT')?.result || null,
    fundamental: fanOutResults.find((item) => item.node === 'FUNDAMENTAL_AGENT')?.result || null,
    sentiment: fanOutResults.find((item) => item.node === 'SENTIMENT_AGENT')?.result || null
  };

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
