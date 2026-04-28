'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AdvancedInspector } from './advanced-inspector';
import { AgentCard } from './agent-card';
import { CYCLE_FEED, EXPLAINER_SCRIPT, JOURNEY_STEPS } from './mock-data';
import type { AgentStatus } from './types';

const statusForStep = (stepIndex: number, activeIndex: number): AgentStatus => {
  if (stepIndex < activeIndex) return 'done';
  if (stepIndex === activeIndex) return 'thinking';
  return 'waiting';
};

const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const actionTone: Record<string, string> = {
  BUY: 'text-emerald-700 bg-emerald-100',
  HOLD: 'text-amber-700 bg-amber-100',
  SELL: 'text-rose-700 bg-rose-100'
};

export function AIThinkingJourney() {
  const [cycleIndex, setCycleIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [streamText, setStreamText] = useState('');

  const cycle = CYCLE_FEED[cycleIndex % CYCLE_FEED.length];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = prev + 1;
        if (next >= JOURNEY_STEPS.length) {
          setCycleIndex((current) => current + 1);
          setStreamText('');
          return 0;
        }
        return next;
      });
    }, 1900);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const current = JOURNEY_STEPS[activeIndex];
    if (current?.id !== 'ai-explainer') return;

    const text = EXPLAINER_SCRIPT.join(' ');
    let pointer = 0;
    const streamTimer = setInterval(() => {
      pointer += 1;
      setStreamText(text.slice(0, pointer));
      if (pointer >= text.length) clearInterval(streamTimer);
    }, 24);

    return () => clearInterval(streamTimer);
  }, [activeIndex, cycleIndex]);

  const statuses = useMemo(
    () => Object.fromEntries(JOURNEY_STEPS.map((step, index) => [step.title, statusForStep(index, activeIndex)])),
    [activeIndex]
  );

  const currentStage = JOURNEY_STEPS[activeIndex]?.title || 'Starting';

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-5 py-10 md:px-10">
      <section className="rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-premium">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">AI Thinking Journey</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{cycle.symbol}</h1>
            <p className="mt-1 text-sm text-slate-500">A calm, step-by-step story of how friendly AI experts reason together.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">Current Price</p>
              <p className="text-xl font-semibold text-slate-900">{price.format(cycle.price)}</p>
              <p className={`text-xs ${cycle.changePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {cycle.changePct >= 0 ? '+' : ''}{cycle.changePct.toFixed(2)}%
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInspectorOpen((prev) => !prev)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {inspectorOpen ? 'Hide inspector' : 'Show inspector'}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-7 flex gap-6">
        <div className="min-w-0 flex-1 overflow-x-auto pb-2">
          <div className="flex min-w-max items-start gap-4 pr-6">
            {JOURNEY_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center gap-4">
                <AgentCard
                  step={step}
                  status={statusForStep(index, activeIndex)}
                  isActive={index === activeIndex}
                  explainerStream={step.id === 'ai-explainer' ? streamText : ''}
                  showLearnMore={expandedId === step.id}
                  onToggleLearnMore={() => setExpandedId((prev) => (prev === step.id ? null : step.id))}
                />
                {index < JOURNEY_STEPS.length - 1 ? <div className="h-0.5 w-8 rounded-full bg-slate-200" /> : null}
              </div>
            ))}
          </div>
        </div>

        <AdvancedInspector open={inspectorOpen} activeStepTitle={currentStage} statuses={statuses} symbol={cycle.symbol} />
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-premium">
        <h2 className="text-lg font-semibold text-slate-900">What happened this cycle?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{cycle.narratedSummary}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${actionTone[cycle.finalAction]}`}>Final simulated action: {cycle.finalAction}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cycle.safetyIntervened ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
            {cycle.safetyIntervened ? 'Safety Guard intervened' : 'No safety intervention needed'}
          </span>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Current stage: {currentStage}</span>
        </div>

        <AnimatePresence mode="wait">
          {cycle.safetyIntervened ? (
            <motion.div
              key={`intervention-${cycleIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              Safety Guard protection activated: it adjusted the original path to reduce risk before execution.
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    </main>
  );
}
