import type { AccountSummary, EventType } from './api.js';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  call_received: 'Calls',
  lead_created: 'Leads',
  appointment_set: 'Appointments',
};

export function Controls({
  accounts,
  weeks,
  account,
  type,
  week,
  onChange,
}: {
  accounts: AccountSummary[];
  /** This account's own evaluable weeks, most recent first — never later than the dataset's
   * own latest completed week. */
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
          {[...weeks]
            .reverse()
            .map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}
