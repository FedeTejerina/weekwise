// Type-only imports from the server's own source — erased at build time, so the browser
// bundle never pulls in `pg` or any other Node-only code from `weeklyCheck.ts`. This is the
// same reuse-not-reimplementation pattern as `wording.ts` (T10 -> T12's interface).
import type { EventType, WeeklyCheckResponse } from '../../server/src/weeklyCheck.js';

export type { EventType, WeeklyCheckResponse };

export interface AccountSummary {
  id: number;
  name: string;
  timezone: string;
  locationCount: number;
}

export async function fetchAccounts(): Promise<AccountSummary[]> {
  const response = await fetch('/api/accounts');
  if (!response.ok) {
    throw new Error(`GET /api/accounts failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchWeeklyCheck(
  account: string,
  type: string,
  week: string,
): Promise<WeeklyCheckResponse> {
  const params = new URLSearchParams({ account, type, week });
  const response = await fetch(`/api/weekly-check?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`GET /api/weekly-check failed: ${response.status}`);
  }
  return response.json();
}
