"use client";

import { DistributionBar } from "./DistributionBar";

type ScoreCardProps = {
  label: string;
  earned: number;
  max: number;
  deductions: string[];
};

export function ScoreCard({ label, earned, max, deductions }: ScoreCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
      <DistributionBar label={label} value={earned} max={max} />
      {deductions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Deductions</p>
          <ul className="space-y-0.5">
            {deductions.map((d, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-tertiary)]" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ScoreCardGrid({ cards }: { cards: ScoreCardProps[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <ScoreCard key={card.label} {...card} />
      ))}
    </div>
  );
}
