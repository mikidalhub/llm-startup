export type AgentStatus = 'waiting' | 'thinking' | 'done';

export type StepId =
  | 'market-watcher'
  | 'technical-analyst'
  | 'fundamental-analyst'
  | 'sentiment-analyst'
  | 'risk-analyst'
  | 'head-teacher'
  | 'ai-explainer'
  | 'safety-guard'
  | 'trade-executor';

export type AgentStep = {
  id: StepId;
  title: string;
  shortRole: string;
  icon: string;
  thoughtBubble: string;
  learnMore: string;
  accentClass: string;
};

export type TradeAction = 'BUY' | 'HOLD' | 'SELL';

export type CycleSnapshot = {
  symbol: string;
  price: number;
  changePct: number;
  decisionBeforeSafety: TradeAction;
  finalAction: TradeAction;
  safetyIntervened: boolean;
  narratedSummary: string;
  simpleTimeline: string[];
};
