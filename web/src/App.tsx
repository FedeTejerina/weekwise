import { useEffect, useState } from 'react';
import { fetchAccounts, fetchWeeklyCheck, type AccountSummary, type EventType, type WeeklyCheckResponse } from './api.js';
import { Controls } from './Controls.js';
import { InProgressLine } from './InProgressLine.js';
import { LocationsSection } from './LocationsSection.js';
import { useUrlState } from './useUrlState.js';
import { VerdictSection } from './VerdictSection.js';

const VALID_EVENT_TYPES: readonly EventType[] = ['call_received', 'lead_created', 'appointment_set'];
const DEFAULT_EVENT_TYPE: EventType = 'call_received';

export function App() {
  const [urlState, setUrlState] = useUrlState();
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const [data, setData] = useState<WeeklyCheckResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts()
      .then(setAccounts)
      .catch(() => setLoadError('Could not load accounts.'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchWeeklyCheck(urlState.account, urlState.type, urlState.week)
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setLoadError(null);

        // D15: the server already fell back to defaults for anything invalid; reconcile the
        // URL to match what it actually resolved, rather than leaving a stale/invalid URL
        // displayed. `type` needs no server round trip to validate — it's a fixed, small enum.
        const resolvedType = VALID_EVENT_TYPES.includes(urlState.type as EventType)
          ? urlState.type
          : DEFAULT_EVENT_TYPE;
        const resolvedAccount = String(response.account.id);
        const resolvedWeek = response.week.start;
        if (resolvedAccount !== urlState.account || resolvedType !== urlState.type || resolvedWeek !== urlState.week) {
          setUrlState({ account: resolvedAccount, type: resolvedType, week: resolvedWeek }, false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this account\'s weekly check.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlState.account, urlState.type, urlState.week]);

  const eventType: EventType = VALID_EVENT_TYPES.includes(urlState.type as EventType)
    ? (urlState.type as EventType)
    : DEFAULT_EVENT_TYPE;

  function handleControlChange(next: { account?: string; type?: string; week?: string }) {
    setUrlState(
      {
        account: next.account ?? urlState.account,
        type: next.type ?? urlState.type,
        week: next.week ?? urlState.week,
      },
      true,
    );
  }

  return (
    <main>
      <h1>WeekWise</h1>

      {loadError && <p role="alert">{loadError}</p>}

      {accounts && data && (
        <Controls
          accounts={accounts}
          weeks={data.weeks}
          account={String(data.account.id)}
          type={eventType}
          week={data.week.start}
          onChange={handleControlChange}
        />
      )}

      {data && (
        <>
          <InProgressLine inProgress={data.inProgress} eventType={eventType} />
          <VerdictSection verdict={data.verdict} week={data.week} eventType={eventType} />
          {data.locations && <LocationsSection locations={data.locations} eventType={eventType} />}
        </>
      )}
    </main>
  );
}
