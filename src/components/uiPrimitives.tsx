import type { LucideIcon } from 'lucide-react';
import type { Tone } from '../data/fixtures';

export const toneLabels: Record<Tone, string> = {
  ok: 'Good',
  watch: 'Watch',
  risk: 'Risk',
  neutral: 'Info',
};

export function toneClass(tone: Tone | 'review') {
  return `tone-${tone}`;
}

export function ViewHeading({
  icon: Icon,
  title,
  meta,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  meta: string;
  actionLabel?: string;
}) {
  return (
    <div className="view-heading">
      <div>
        <Icon size={20} aria-hidden="true" />
        <div>
          <h2>{title}</h2>
          <p>{meta}</p>
        </div>
      </div>
      {actionLabel && (
        <button type="button" className="text-action">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function Metric({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className={`metric ${toneClass(tone)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function EmptyState({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return (
    <div className={compact ? 'empty-state compact' : 'empty-state'}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}
