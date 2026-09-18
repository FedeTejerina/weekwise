import { inProgressLine } from '../../server/src/wording.js';
import { Emphasized } from './Emphasized.js';
import type { EventType, WeeklyCheckResponse } from './api.js';

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** D18/T9: a plain fact, shown above the verdict — never inside it, never a comparison. */
export function InProgressLine({
  inProgress,
  eventType,
}: {
  inProgress: WeeklyCheckResponse['inProgress'];
  eventType: EventType;
}) {
  if (!inProgress) {
    return null;
  }
  // The current date within the account's own in-progress week — derived from that week's own
  // start + elapsed days, not re-parsed out of the dataset's UTC as-of moment, so it can never
  // land on the wrong calendar day for this account's timezone.
  const currentDate = addDays(inProgress.weekStart, inProgress.daysIn - 1);
  const parts = inProgressLine(inProgress, currentDate, eventType);
  if (!parts) {
    return null;
  }
  return (
    <p className="in-progress">
      <Emphasized parts={parts} />
    </p>
  );
}
