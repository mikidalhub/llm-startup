'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { AgentStatus } from './types';

type AdvancedInspectorProps = {
  open: boolean;
  activeStepTitle: string;
  statuses: Record<string, AgentStatus>;
  symbol: string;
};

export function AdvancedInspector({ open, activeStepTitle, statuses, symbol }: AdvancedInspectorProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-premium"
        >
          <h4 className="text-sm font-semibold text-slate-900">Advanced Inspector</h4>
          <p className="mt-1 text-xs text-slate-500">Optional developer context (hidden by default).</p>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            <p><span className="font-medium text-slate-900">Symbol:</span> {symbol}</p>
            <p><span className="font-medium text-slate-900">Current Stage:</span> {activeStepTitle}</p>
            <div>
              <p className="mb-1 font-medium text-slate-900">Stage Statuses</p>
              <ul className="space-y-1">
                {Object.entries(statuses).map(([id, status]) => (
                  <li key={id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1">
                    <span>{id}</span>
                    <span className="capitalize">{status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
