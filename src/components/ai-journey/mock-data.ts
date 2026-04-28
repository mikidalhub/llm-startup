import type { AgentStep, CycleSnapshot, StepId } from './types';

export const JOURNEY_STEPS: AgentStep[] = [
  {
    id: 'market-watcher',
    title: 'Market Watcher',
    icon: '📡',
    shortRole: 'Checks today’s price, activity, and momentum clues.',
    thoughtBubble: '“I gathered today’s market pulse and sent it to our experts.”',
    learnMore: 'This kickoff step watches simple clues like price movement, trading activity, and momentum so the rest of the team starts from shared evidence.',
    accentClass: 'from-sky-100 to-cyan-100'
  },
  {
    id: 'technical-analyst',
    title: 'Technical Analyst',
    icon: '📈',
    shortRole: 'Reads chart patterns and trend strength.',
    thoughtBubble: '“The trend is calm, with no major chart alarm right now.”',
    learnMore: 'Technical analysis looks at chart behavior. It helps the team see whether momentum is strong, weak, or simply neutral.',
    accentClass: 'from-indigo-100 to-violet-100'
  },
  {
    id: 'fundamental-analyst',
    title: 'Fundamental Analyst',
    icon: '🏛️',
    shortRole: 'Checks business quality and long-term strength.',
    thoughtBubble: '“The business looks strong, so quality remains supportive.”',
    learnMore: 'Fundamental analysis focuses on company health: financial strength, profitability quality, and long-term durability.',
    accentClass: 'from-amber-100 to-orange-100'
  },
  {
    id: 'sentiment-analyst',
    title: 'Sentiment Analyst',
    icon: '💬',
    shortRole: 'Listens to market mood from news and chatter.',
    thoughtBubble: '“Crowd emotions are balanced, not too fearful or too excited.”',
    learnMore: 'Sentiment helps identify emotional pressure from the crowd, so decisions are not based on panic or hype alone.',
    accentClass: 'from-pink-100 to-rose-100'
  },
  {
    id: 'risk-analyst',
    title: 'Risk Analyst',
    icon: '🛡️',
    shortRole: 'Measures downside danger before any action.',
    thoughtBubble: '“I checked risk limits so we protect capital first.”',
    learnMore: 'Risk checks estimate downside scenarios and make sure potential loss stays inside strict safety boundaries.',
    accentClass: 'from-emerald-100 to-teal-100'
  },
  {
    id: 'head-teacher',
    title: 'Head Teacher Decision',
    icon: '🧠',
    shortRole: 'Combines expert inputs into one clear thesis.',
    thoughtBubble: '“I formed a disciplined BUY / HOLD / SELL lesson for this cycle.”',
    learnMore: 'The Head Teacher applies deterministic rules to combine every expert signal into a single, consistent decision.',
    accentClass: 'from-violet-100 to-fuchsia-100'
  },
  {
    id: 'ai-explainer',
    title: 'AI Explainer',
    icon: '✨',
    shortRole: 'Streams a beginner-friendly explanation in plain language.',
    thoughtBubble: '“I’ll explain this as if we’re learning together for the first time.”',
    learnMore: 'This teaching step translates the team’s reasoning into simple, friendly language so beginners and kids can understand the “why.”',
    accentClass: 'from-blue-100 to-indigo-100'
  },
  {
    id: 'safety-guard',
    title: 'Safety Guard',
    icon: '🚦',
    shortRole: 'Can override decisions to prevent unsafe actions.',
    thoughtBubble: '“I protect the portfolio. If danger is high, I intervene.”',
    learnMore: 'Safety Guard is the protective layer. It can block or modify a decision when risk constraints are violated.',
    accentClass: 'from-rose-100 to-orange-100'
  },
  {
    id: 'trade-executor',
    title: 'Trade Executor',
    icon: '🤝',
    shortRole: 'Records the final simulated BUY / HOLD / SELL action.',
    thoughtBubble: '“Simulation complete. The final action is safely recorded.”',
    learnMore: 'The final step executes a simulated action only after every educational and safety check is complete.',
    accentClass: 'from-slate-100 to-zinc-100'
  }
];

export const CYCLE_FEED: CycleSnapshot[] = [
  {
    symbol: 'AAPL',
    price: 214.22,
    changePct: 0.7,
    decisionBeforeSafety: 'HOLD',
    finalAction: 'HOLD',
    safetyIntervened: false,
    narratedSummary: 'The team liked the company quality but did not see a strong enough edge, so it chose patience with a HOLD simulation.',
    simpleTimeline: [
      'Market Watcher found stable momentum.',
      'Expert Team agreed quality is strong but not deeply discounted.',
      'Head Teacher suggested HOLD.',
      'Safety Guard approved with no changes.',
      'Trade Executor recorded a simulated HOLD.'
    ]
  },
  {
    symbol: 'NVDA',
    price: 996.1,
    changePct: -1.4,
    decisionBeforeSafety: 'BUY',
    finalAction: 'BUY',
    safetyIntervened: false,
    narratedSummary: 'After a healthy cooldown, the team saw enough quality and trend support to run a cautious BUY simulation.',
    simpleTimeline: [
      'Market Watcher saw momentum cooling.',
      'Experts found strong quality with manageable risk.',
      'Head Teacher suggested BUY.',
      'Safety Guard approved with no override.',
      'Trade Executor recorded a simulated BUY.'
    ]
  },
  {
    symbol: 'TSLA',
    price: 179.84,
    changePct: -3.1,
    decisionBeforeSafety: 'BUY',
    finalAction: 'SELL',
    safetyIntervened: true,
    narratedSummary: 'The original idea was BUY, but Safety Guard detected elevated downside risk and switched the final simulation to SELL.',
    simpleTimeline: [
      'Market Watcher reported sharp volatility.',
      'Expert Team was mixed on signal quality.',
      'Head Teacher initially suggested BUY.',
      'Safety Guard intervened and changed the decision to SELL.',
      'Trade Executor recorded a simulated SELL.'
    ]
  }
];

export const EXPLAINER_SCRIPT_BY_SYMBOL: Record<string, string[]> = {
  AAPL: [
    'First, we looked at simple market clues from today.',
    'Next, our expert team compared chart trend, business quality, and risk.',
    'The Head Teacher chose HOLD because patience looked wiser than rushing.',
    'Safety Guard agreed this was already a safe action.',
    'So we recorded a simulated HOLD and saved the lesson for next cycle.'
  ],
  NVDA: [
    'Today the stock cooled down after strong movement.',
    'Our experts checked that quality remained strong while risk stayed acceptable.',
    'That gave the Head Teacher enough confidence for a careful BUY simulation.',
    'Safety Guard confirmed risk limits were respected.',
    'So we completed a simulated BUY with disciplined sizing.'
  ],
  TSLA: [
    'We started with volatile market signals and mixed expert opinions.',
    'The first classroom decision was BUY based on potential rebound.',
    'Then Safety Guard detected risk pressure above our comfort limit.',
    'To protect capital, it overrode the path to SELL.',
    'The final simulation became SELL, prioritizing safety over optimism.'
  ]
};

export const STEP_INDEX: Record<StepId, number> = Object.fromEntries(
  JOURNEY_STEPS.map((step, index) => [step.id, index])
) as Record<StepId, number>;
