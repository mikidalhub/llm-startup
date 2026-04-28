'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { AgentStatus, AgentStep, TradeAction } from './types';

const statusStyle: Record<AgentStatus, string> = {
  waiting: 'bg-slate-100 text-slate-500',
  thinking: 'bg-violet-100 text-violet-700',
  done: 'bg-emerald-100 text-emerald-700'
};

const statusText: Record<AgentStatus, string> = {
  waiting: 'Waiting',
  thinking: 'Thinking',
  done: 'Done'
};

const actionTone: Record<TradeAction, string> = {
  BUY: 'bg-emerald-100 text-emerald-700',
  HOLD: 'bg-amber-100 text-amber-700',
  SELL: 'bg-rose-100 text-rose-700'
};

type AgentCardProps = {
  step: AgentStep;
  status: AgentStatus;
  isActive: boolean;
  explainerStream?: string;
  showLearnMore: boolean;
  onToggleLearnMore: () => void;
  showSafetyIntervention?: boolean;
  decisionBeforeSafety?: TradeAction;
  finalAction: TradeAction;
};

export function AgentCard({
  step,
  status,
  isActive,
  explainerStream = '',
  showLearnMore,
  onToggleLearnMore,
  showSafetyIntervention,
  decisionBeforeSafety,
  finalAction
}: AgentCardProps) {
  const renderedThought = step.id === 'ai-explainer' && explainerStream ? explainerStream : step.thoughtBubble;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={[
        'w-[300px] shrink-0 rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_14px_45px_rgba(15,23,42,0.09)] backdrop-blur',
        isActive ? 'ring-2 ring-violet-300 shadow-[0_20px_55px_rgba(124,58,237,0.25)]' : ''
      ].join(' ')}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${step.accentClass} text-xl shadow-sm`}>
            {step.icon}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{step.title}</h3>
            <p className="line-clamp-2 text-xs text-slate-500">{step.shortRole}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyle[status]}`}>{statusText[status]}</span>
      </div>

      <motion.div
        animate={isActive ? { scale: [1, 1.01, 1], opacity: [0.95, 1, 0.95] } : { scale: 1, opacity: 1 }}
        transition={{ repeat: isActive ? Infinity : 0, duration: 1.8 }}
        className="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700"
      >
        {renderedThought}
      </motion.div>

      {step.id === 'safety-guard' && showSafetyIntervention ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          Intervention: changed {decisionBeforeSafety} → {finalAction} for protection.
        </motion.div>
      ) : null}

      {step.id === 'trade-executor' ? (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-xs">
          <span className="font-medium text-slate-600">Final simulated action</span>
          <span className={`rounded-full px-2 py-1 font-semibold ${actionTone[finalAction]}`}>{finalAction}</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onToggleLearnMore}
        className="mt-3 text-xs font-medium text-violet-700 transition hover:text-violet-900"
      >
        {showLearnMore ? 'Hide details' : 'Learn more'}
      </button>

      <AnimatePresence>
        {showLearnMore ? (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 overflow-hidden text-xs leading-relaxed text-slate-500"
          >
            {step.learnMore}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
