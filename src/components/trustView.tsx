import { Activity, AlertCircle, CheckCircle2, Info, ShieldAlert, type LucideIcon } from 'lucide-react';
import type { DashboardData, Tone } from '../data/fixtures';
import { Metric, toneClass, toneLabels, ViewHeading } from './uiPrimitives';

export function TrustView({ ops }: { ops: DashboardData['ops'] }) {
  const verifiedCount = ops.filter((item) => item.tone === 'ok').length;
  const gapCount = ops.filter((item) => item.tone === 'neutral').length;
  const watchCount = ops.filter((item) => item.tone === 'watch').length;
  const riskCount = ops.filter((item) => item.tone === 'risk').length;
  const verifiedPercent = formatClearPercent({ clearCount: verifiedCount, totalCount: ops.length });
  const verifiedTone: Tone = riskCount > 0 ? 'risk' : watchCount > 0 ? 'watch' : gapCount > 0 ? 'neutral' : 'ok';
  const sortedOps = [...ops].sort((left, right) => toneRank[left.tone] - toneRank[right.tone]);
  const leadIssue = sortedOps.find((item) => item.tone === 'risk' || item.tone === 'watch');

  return (
    <div className="view-stack">
      <ViewHeading icon={Activity} title="Data Trust" meta={`${formatSourceCount(ops.length)} observed`} />
      <section className="split-summary trust-summary" aria-label="Trust summary">
        <Metric label="Verified" value={verifiedPercent} tone={verifiedTone} />
        <Metric label="Lead issue" value={leadIssue?.label ?? 'Clear'} tone={leadIssue?.tone ?? 'ok'} />
        <Metric label="Watch" value={formatSourceCount(watchCount)} tone={watchCount > 0 ? 'watch' : 'ok'} />
        <Metric label="Risk" value={formatSourceCount(riskCount)} tone={riskCount > 0 ? 'risk' : 'ok'} />
      </section>
      <div className="ops-detail-grid">
        {sortedOps.map((item) => {
          const StatusIcon = statusIconForTone(item.tone);
          return (
            <article className="ops-detail" key={item.label}>
              <div className="ops-detail-main">
                <StatusIcon className={toneClass(item.tone)} size={22} aria-hidden="true" />
                <div>
                  <h3>{item.label}</h3>
                  <p>{item.value}</p>
                </div>
              </div>
              <span className={`ops-detail-state ${toneClass(item.tone)}`}>{toneLabels[item.tone]}</span>
            </article>
          );
        })}
      </div>
    </div>
  );
}

const toneRank: Record<Tone, number> = {
  risk: 0,
  watch: 1,
  neutral: 2,
  ok: 3,
};

function formatSourceCount(count: number) {
  return `${count} ${count === 1 ? 'source' : 'sources'}`;
}

function formatClearPercent({ clearCount, totalCount }: { clearCount: number; totalCount: number }) {
  if (totalCount === 0) {
    return '0%';
  }

  return `${Math.round((clearCount / totalCount) * 100)}%`;
}

function statusIconForTone(tone: Tone): LucideIcon {
  if (tone === 'risk') {
    return ShieldAlert;
  }

  if (tone === 'watch') {
    return AlertCircle;
  }

  if (tone === 'neutral') {
    return Info;
  }

  return CheckCircle2;
}
