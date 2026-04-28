import type { AgentStep, CycleSnapshot } from './types';

export const JOURNEY_STEPS: AgentStep[] = [
  {
    id: 'market-watcher',
    title: 'Market Watcher',
    icon: '📡',
    shortRole: 'Looks at today’s market pulse for this stock.',
    thoughtBubble: '“I see price, activity, and momentum. Let’s pass this to the team.”',
    learnMore: 'This step collects simple market signals like price, volume, and momentum to start the cycle.'
  },
  {
    id: 'technical-analyst',
    title: 'Technical Analyst',
    icon: '📈',
    shortRole: 'Checks chart patterns and momentum clues.',
    thoughtBubble: '“The chart looks balanced right now with no extreme pressure.”',
    learnMore: 'The technical analyst focuses on chart behavior and momentum to spot overbought or oversold conditions.'
  },
  {
    id: 'fundamental-analyst',
    title: 'Fundamental Analyst',
    icon: '🏛️',
    shortRole: 'Looks at business quality and company strength.',
    thoughtBubble: '“Business quality is steady, but valuation must still make sense.”',
    learnMore: 'This step checks financial quality, balance sheet health, and long-term business strength.'
  },
  {
    id: 'sentiment-analyst',
    title: 'Sentiment Analyst',
    icon: '💬',
    shortRole: 'Reads the mood from headlines and chatter.',
    thoughtBubble: '“Public mood is neutral, so no emotional extremes right now.”',
    learnMore: 'Sentiment helps detect whether the crowd mood is fearful, excited, or neutral.'
  },
  {
    id: 'risk-analyst',
    title: 'Risk Analyst',
    icon: '🛡️',
    shortRole: 'Measures danger before any action is allowed.',
    thoughtBubble: '“Potential downside is acceptable, but we stay disciplined.”',
    learnMore: 'Risk checks protect capital first by measuring volatility and downside exposure.'
  },
  {
    id: 'head-teacher',
    title: 'Head Teacher Decision',
    icon: '🧠',
    shortRole: 'Combines all signals into one clear decision.',
    thoughtBubble: '“My current lesson: HOLD and wait for a better edge.”',
    learnMore: 'This step applies deterministic investing rules to produce BUY, HOLD, or SELL with confidence.'
  },
  {
    id: 'ai-explainer',
    title: 'AI Explainer',
    icon: '✨',
    shortRole: 'Turns the decision into simple beginner language.',
    thoughtBubble: '“I’ll explain this recommendation in plain, calm steps.”',
    learnMore: 'The explainer generates child-friendly teaching text so the user understands not just what, but why.'
  },
  {
    id: 'safety-guard',
    title: 'Safety Guard',
    icon: '🚦',
    shortRole: 'Can override decisions when protection is needed.',
    thoughtBubble: '“If risk is too high, I can step in and block unsafe moves.”',
    learnMore: 'Safety Guard enforces protection rules like stop-loss and position safety limits.'
  },
  {
    id: 'trade-executor',
    title: 'Trade Executor',
    icon: '🤝',
    shortRole: 'Executes the final simulated action safely.',
    thoughtBubble: '“Final simulated action recorded. Cycle complete.”',
    learnMore: 'This step performs the final simulated BUY/HOLD/SELL action and records outcomes.'
  }
];

export const CYCLE_FEED: CycleSnapshot[] = [
  {
    symbol: 'AAPL',
    price: 214.22,
    changePct: 0.7,
    finalAction: 'HOLD',
    safetyIntervened: false,
    narratedSummary: 'The team saw stable quality but no strong discount, so it chose HOLD and patience.'
  },
  {
    symbol: 'NVDA',
    price: 996.1,
    changePct: -1.4,
    finalAction: 'BUY',
    safetyIntervened: false,
    narratedSummary: 'Momentum cooled while quality stayed strong, so the team opened a careful BUY simulation.'
  },
  {
    symbol: 'TSLA',
    price: 179.84,
    changePct: -3.1,
    finalAction: 'SELL',
    safetyIntervened: true,
    narratedSummary: 'Safety Guard stepped in and changed the path to SELL to protect from deeper downside.'
  }
];

export const EXPLAINER_SCRIPT = [
  'We begin with simple evidence from today’s market.',
  'Next, our expert team compares momentum, business strength, and risk.',
  'The Head Teacher forms one disciplined decision.',
  'Safety Guard checks if protection rules should intervene.',
  'Finally, we record a simulated action and explain what to learn.'
];
