export type AgentStatus = 'waiting' | 'thinking' | 'done';

export type AgentStep = {
  id: string;
  title: string;
  shortRole: string;
  icon: string;
  thoughtBubble: string;
  learnMore: string;
};

export type CycleSnapshot = {
  symbol: string;
  price: number;
  changePct: number;
  finalAction: 'BUY' | 'HOLD' | 'SELL';
  safetyIntervened: boolean;
  narratedSummary: string;
};
