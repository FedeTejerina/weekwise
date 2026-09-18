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
    // T7's real response never carries weeksHave/weeksNeeded for this state (log I3: the seed
    // can't produce it for anything the app actually queries) — wording.ts's short form
    // handles that, rather than this component fabricating numbers to fill the gap.
  });

  return (
    <p className="verdict">
      <Emphasized parts={parts} />
    </p>
  );
}
