import { verdictSentence } from '../../server/src/wording.js';
import { Emphasized } from './Emphasized.js';
import type { EventType, WeeklyCheckResponse } from './api.js';

export function VerdictSection({
  verdict,
  week,
  eventType,
}: {
  verdict: WeeklyCheckResponse['verdict'];
  week: WeeklyCheckResponse['week'];
  eventType: EventType;
}) {
  const parts = verdictSentence({
    state: verdict.state,
    count: verdict.count,
    typical: verdict.typical,
    usualRange: verdict.usualRange,
    weekStart: week.start,
    weekEnd: week.end,
    eventType,
    // Present only for not_enough_history, and only when the account has some history at all
    // (R1 #3) — undefined otherwise, which is exactly when wording.ts's short form applies
    // (an account with zero events ever, e.g. account 20).
    weeksHave: verdict.weeksHave,
    weeksNeeded: verdict.weeksNeeded,
  });

  return (
    <p className="verdict">
      <Emphasized parts={parts} />
    </p>
  );
}
