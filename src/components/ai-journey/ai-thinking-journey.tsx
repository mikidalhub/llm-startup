'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AdvancedInspector } from './advanced-inspector';
import { AgentCard } from './agent-card';
import { CYCLE_FEED, EXPLAINER_SCRIPT_BY_SYMBOL, JOURNEY_STEPS, STEP_INDEX } from './mock-data';
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
    }, 1800);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const current = JOURNEY_STEPS[activeIndex];
    if (current?.id !== 'ai-explainer') return;

    const script = EXPLAINER_SCRIPT_BY_SYMBOL[cycle.symbol] || [];
    const text = script.join(' ');
    let pointer = 0;
    const streamTimer = setInterval(() => {
      pointer += 1;
      setStreamText(text.slice(0, pointer));
      if (pointer >= text.length) clearInterval(streamTimer);
    }, 18);

    return () => clearInterval(streamTimer);
  }, [activeIndex, cycle.symbol]);

  const statuses = useMemo(
    () => Object.fromEntries(JOURNEY_STEPS.map((step, index) => [step.title, statusForStep(index, activeIndex)])),
    [activeIndex]
  );

  const currentStage = JOURNEY_STEPS[activeIndex]?.title || 'Starting';

  return (
    <main className="mx-auto min-h-screen max-w-[1700px] px-5 py-10 md:px-10">
      <section className="rounded-2xl border border-white/80 bg-white/90 p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-violet-600">AI Thinking Journey</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{cycle.symbol}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Watch friendly AI experts think from left to right in one calm learning story. No jargon, just clear decisions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">Current Price</p>
              <p className="text-2xl font-semibold text-slate-900">{price.format(cycle.price)}</p>
              <p className={`text-xs ${cycle.changePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {cycle.changePct >= 0 ? '+' : ''}
                {cycle.changePct.toFixed(2)}%
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
        <div className="min-w-0 flex-1 overflow-x-auto pb-3">
          <div className="mb-3 inline-flex rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
            Expert Team: Technical + Fundamental + Sentiment + Risk
          </div>
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
                  showSafetyIntervention={
                    step.id === 'safety-guard' &&
                    cycle.safetyIntervened &&
                    activeIndex >= STEP_INDEX['safety-guard']
                  }
                  decisionBeforeSafety={cycle.decisionBeforeSafety}
                  finalAction={cycle.finalAction}
                />
                {index < JOURNEY_STEPS.length - 1 ? (
                  <motion.div
                    animate={activeIndex > index ? { opacity: 1, scaleX: 1 } : { opacity: 0.45, scaleX: 0.7 }}
                    className="h-1 w-10 origin-left rounded-full bg-gradient-to-r from-violet-200 to-sky-200"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <AdvancedInspector open={inspectorOpen} activeStepTitle={currentStage} statuses={statuses} symbol={cycle.symbol} />
      </section>

      <section className="mt-8 rounded-2xl border border-white/80 bg-white/90 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-slate-900">What happened this cycle?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{cycle.narratedSummary}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${actionTone[cycle.finalAction]}`}>
            Final simulated action: {cycle.finalAction}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              cycle.safetyIntervened ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {cycle.safetyIntervened ? 'Safety Guard intervened' : 'No safety intervention needed'}
          </span>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Current stage: {currentStage}</span>
        </div>

        <ol className="mt-5 space-y-2">
          {cycle.simpleTimeline.map((line) => (
            <li key={line} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {line}
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait">
          {cycle.safetyIntervened && activeIndex >= STEP_INDEX['safety-guard'] ? (
            <motion.div
              key={`intervention-${cycleIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              Safety Guard protection activated: it overrode {cycle.decisionBeforeSafety} to {cycle.finalAction} before execution.
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    </main>
  );
}
