'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { AgentStatus, AgentStep } from './types';

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

type AgentCardProps = {
  step: AgentStep;
  status: AgentStatus;
  isActive: boolean;
  explainerStream?: string;
  showLearnMore: boolean;
  onToggleLearnMore: () => void;
};

export function AgentCard({ step, status, isActive, explainerStream = '', showLearnMore, onToggleLearnMore }: AgentCardProps) {
  const renderedThought = step.id === 'ai-explainer' && explainerStream ? explainerStream : step.thoughtBubble;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={[
        'w-[280px] shrink-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-premium',
        isActive ? 'ring-2 ring-violet-300 shadow-[0_20px_40px_rgba(139,92,246,0.22)]' : ''
      ].join(' ')}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-xl">{step.icon}</div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
            <p className="text-xs text-slate-500">{step.shortRole}</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyle[status]}`}>{statusText[status]}</span>
      </div>

      <motion.div
        animate={isActive ? { scale: [1, 1.01, 1] } : { scale: 1 }}
        transition={{ repeat: isActive ? Infinity : 0, duration: 1.6 }}
        className="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700"
      >
        {renderedThought}
      </motion.div>

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
