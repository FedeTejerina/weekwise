import { locationFlaggedSentence, locationsNotEnoughHistoryLine, locationsQuietLine } from '../../server/src/wording.js';
import { Emphasized } from './Emphasized.js';
import type { EventType, WeeklyCheckResponse } from './api.js';

/** D16: only rendered when the account has 2+ locations at all — the parent skips this
 * component entirely otherwise, since the API omits `locations` for those accounts. */
export function LocationsSection({
  locations,
  eventType,
}: {
  locations: NonNullable<WeeklyCheckResponse['locations']>;
  eventType: EventType;
}) {
  const { flagged, notEnoughHistory, quietCount, window } = locations;

  return (
    <div className="locations">
      {flagged.length > 0 && (
        <ul>
          {flagged.map((flag) => (
            <li key={flag.location}>
              <Emphasized
                parts={locationFlaggedSentence({
                  location: flag.location,
                  count: flag.count,
                  usualRange: flag.usualRange,
                  eventType,
                  windowEnd: window.end,
                })}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Only when at least one location was actually verified quiet (R1 #1) — otherwise every
          location is not-enough-history, and "nothing unusual at any of your 0 locations" was
          reachable on 15 of the 25 weeks the week control offers, on every multi-site account. */}
      {flagged.length === 0 && quietCount > 0 && (
        <p>
          <Emphasized parts={locationsQuietLine(quietCount, window.end)} />
        </p>
      )}

      {notEnoughHistory.length > 0 && (
        <p className="not-enough-history">
          <Emphasized parts={locationsNotEnoughHistoryLine(notEnoughHistory)} />
        </p>
      )}
    </div>
  );
}
