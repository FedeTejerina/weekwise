import { useCallback, useEffect, useState } from 'react';

export interface UrlState {
  account: string;
  type: string;
  week: string;
}

/**
 * D15: account, event type and week live in the URL. Plain `window.history`, no router — one
 * page, three query params, not a set of routes. `push: true` for a user-initiated change (so
 * browser back returns to the previous selection); `push: false` for reconciling the URL after
 * the server resolves invalid/missing values to defaults (so back doesn't return to an invalid
 * URL that never really existed as a distinct navigation state).
 */
export function useUrlState(): [UrlState, (next: UrlState, push: boolean) => void] {
  const [params, setParamsState] = useState<URLSearchParams>(
    () => new URLSearchParams(window.location.search),
  );

  useEffect(() => {
    const onPopState = () => setParamsState(new URLSearchParams(window.location.search));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setParams = useCallback((next: UrlState, push: boolean) => {
    const search = new URLSearchParams({ account: next.account, type: next.type, week: next.week });
    const url = `${window.location.pathname}?${search.toString()}`;
    if (push) {
      window.history.pushState(null, '', url);
    } else {
      window.history.replaceState(null, '', url);
    }
    setParamsState(search);
  }, []);

  return [
    { account: params.get('account') ?? '', type: params.get('type') ?? '', week: params.get('week') ?? '' },
    setParams,
  ];
}
