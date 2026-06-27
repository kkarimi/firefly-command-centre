import { Activity, CheckCircle2 } from 'lucide-react';
import type { DashboardData } from '../data/fixtures';
import { toneClass, ViewHeading } from './uiPrimitives';

export function TrustView({ ops }: { ops: DashboardData['ops'] }) {
  return (
    <div className="view-stack">
      <ViewHeading icon={Activity} title="Data Trust" meta="What this UI can currently verify itself" />
      <div className="ops-detail-grid">
        {ops.map((item) => (
          <article className="ops-detail" key={item.label}>
            <CheckCircle2 className={toneClass(item.tone)} size={22} aria-hidden="true" />
            <div>
              <h3>{item.label}</h3>
              <p>{item.value}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
