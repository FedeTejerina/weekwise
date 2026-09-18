import type { AccountSummary, EventType } from './api.js';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  call_received: 'Calls',
  lead_created: 'Leads',
  appointment_set: 'Appointments',
};

// D8's `BASELINE_WEEKS` (server/src/gate.ts) — kept as a local literal rather than imported,
// since gate.ts pulls in the stats library at runtime and this needs only the number. A week's
// position in `weeks` (its evalIndex, ascending/oldest-first — server/src/weeklyCheck.ts's
// `weekListFrom`) below this can't carry a verdict: D8 needs 12 full baseline weeks before the
// judged week itself.
const BASELINE_WEEKS = 12;

export function Controls({
  accounts,
  weeks,
  account,
  type,
  week,
  onChange,
}: {
  accounts: AccountSummary[];
  /** This account's own evaluable weeks, oldest first (`weekListFrom` in
   * `server/src/weeklyCheck.ts` — array index is the week's `evalIndex`), never later than the
   * dataset's own latest completed week. Reversed below only for display, newest on top. */
  weeks: string[];
  account: string;
  type: EventType;
  week: string;
  onChange: (next: { account?: string; type?: string; week?: string }) => void;
}) {
  return (
    <div className="controls">
      <label>
        Account
        <select value={account} onChange={(e) => onChange({ account: e.target.value })}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Activity
        <select value={type} onChange={(e) => onChange({ type: e.target.value })}>
          {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Week
        <select value={week} onChange={(e) => onChange({ week: e.target.value })}>
          {weeks
            .map((w, evalIndex) => ({ w, needsHistory: evalIndex < BASELINE_WEEKS }))
            .reverse()
            .map(({ w, needsHistory }) => (
              <option key={w} value={w}>
                {needsHistory ? `${w} — needs more history` : w}
              </option>
            ))}
        </select>
        <span className="hint">Verdicts need 13 weeks of history; earlier weeks show why.</span>
      </label>
    </div>
  );
}
