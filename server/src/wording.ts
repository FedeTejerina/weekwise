import type { EventType } from './weeklyCheck.js';

/**
 * The §7 template: pure functions from the §6 response to the §7 sentences. Returns
 * structured parts — `{ text, emphasis }` — not a markdown string; T12 renders `<strong>` from
 * `emphasis`, and nothing here or downstream parses markdown at runtime (T10's own interface
 * with T12, fixed here rather than discovered there).
 */
export interface Parts {
  text: string;
  /** Half-open `[start, end)` character ranges into `text` to render emphasized. */
  emphasis: Array<[number, number]>;
}

const NOUN_BY_EVENT_TYPE: Record<EventType, string> = {
  call_received: 'call',
  lead_created: 'lead',
  appointment_set: 'appointment',
};

function noun(eventType: EventType, count: number): string {
  const base = NOUN_BY_EVENT_TYPE[eventType];
  return count === 1 ? base : `${base}s`;
}

/** Builds `Parts` by concatenation, tracking each emphasized span's index as it's appended —
 * so no span boundary is ever computed by hand against the finished string. */
class PartsBuilder {
  private text = '';
  private emphasis: Array<[number, number]> = [];

  plain(s: string): this {
    this.text += s;
    return this;
  }

  bold(s: string): this {
    const start = this.text.length;
    this.text += s;
    this.emphasis.push([start, this.text.length]);
    return this;
  }

  build(): Parts {
    return { text: this.text, emphasis: this.emphasis };
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function parseDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

function dayAndMonth(isoDate: string): { day: number; month: string } {
  const d = parseDate(isoDate);
  return { day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()]! };
}

/** en-GB, no year, en dash: "20–26 July"; a range spanning two months names both: "29 June – 5 July". */
export function formatDateRange(start: string, end: string): string {
  const s = dayAndMonth(start);
  const e = dayAndMonth(end);
  if (s.month === e.month) {
    return `${s.day}–${e.day} ${s.month}`;
  }
  return `${s.day} ${s.month} – ${e.day} ${e.month}`;
}

/** en-GB, no year: "7 June". */
export function formatDay(isoDate: string): string {
  const { day, month } = dayAndMonth(isoDate);
  return `${day} ${month}`;
}

/** "Mon 27 July". */
export function formatWeekday(isoDate: string): string {
  const d = parseDate(isoDate);
  const { day, month } = dayAndMonth(isoDate);
  return `${WEEKDAYS[d.getUTCDay()]} ${day} ${month}`;
}

/** "Mon 27 July" for day 1 of a week; "Mon–Wed 29 July" for later days — the weekday range
 * ends on the current date, which is the only date that gets a day-of-month. */
export function formatInProgressRange(weekStart: string, currentDate: string): string {
  if (weekStart === currentDate) {
    return `(${formatWeekday(currentDate)})`;
  }
  const startWeekday = WEEKDAYS[parseDate(weekStart).getUTCDay()];
  const currentWeekday = WEEKDAYS[parseDate(currentDate).getUTCDay()];
  const { day, month } = dayAndMonth(currentDate);
  return `(${startWeekday}–${currentWeekday} ${day} ${month})`;
}

export interface SizeDescription {
  /** `'multiple'` at 2x or more, `'percentage'` below that, `'zero'` for a count of zero. */
  kind: 'multiple' | 'percentage' | 'zero';
  /** Rounded ×, only for `kind === 'multiple'`. */
  multiple?: number;
  /** Rounded %, only for `kind === 'percentage'`. */
  percent?: number;
  direction?: 'above' | 'below';
}

/**
 * The size rule (§7's addition note, log I7): a ratio of 2x or more reads as a multiple; below
 * that, as a percentage above or below; a count of zero reads as "no X at all" with no
 * percentage at all — regardless of how far typical is from zero.
 */
export function describeSize(count: number, typical: number): SizeDescription {
  if (count === 0) {
    return { kind: 'zero' };
  }
  const ratio = count / typical;
  if (ratio >= 2) {
    return { kind: 'multiple', multiple: Math.round(ratio) };
  }
  if (ratio >= 1) {
    return { kind: 'percentage', percent: Math.round((ratio - 1) * 100), direction: 'above' };
  }
  return { kind: 'percentage', percent: Math.round((1 - ratio) * 100), direction: 'below' };
}

export interface VerdictFacts {
  state: 'quiet' | 'flagged_up' | 'flagged_down' | 'not_enough_history';
  count?: number;
  typical?: number;
  usualRange?: [number, number];
  weekStart: string;
  weekEnd: string;
  eventType: EventType;
  /** Only used when `state === 'not_enough_history'`. */
  weeksHave?: number;
  weeksNeeded?: number;
}

/** The six account states (§7): quiet; flagged up at 2x+; flagged up under 2x; flagged down;
 * flagged down to zero; not enough history. */
export function verdictSentence(facts: VerdictFacts): Parts {
  const range = formatDateRange(facts.weekStart, facts.weekEnd);
  const et = facts.eventType;

  if (facts.state === 'not_enough_history') {
    return new PartsBuilder()
      .plain(
        `Not enough history yet. Judging a normal week takes ${facts.weeksNeeded ?? 13} weeks ` +
          `of data; you have ${facts.weeksHave ?? 0}.`,
      )
      .build();
  }

  const count = facts.count!;
  const typical = facts.typical!;
  const [lo, hi] = facts.usualRange!;
  const size = describeSize(count, typical);

  if (facts.state === 'quiet') {
    return new PartsBuilder()
      .bold(`${count} ${noun(et, count)}`)
      .plain(` in the week of ${range}. That's `)
      .bold('normal for you')
      .plain(' — your usual week is ')
      .bold(`${lo} to ${hi} ${noun(et, hi)}`)
      .plain('.')
      .build();
  }

  if (size.kind === 'zero') {
    return new PartsBuilder()
      .bold(`No ${noun(et, 0)} at all`)
      .plain(` in the week of ${range}, against a usual `)
      .bold(`${lo} to ${hi}`)
      .plain('.')
      .build();
  }

  const builder = new PartsBuilder()
    .bold(`${count} ${noun(et, count)}`)
    .plain(` in the week of ${range}, against a usual `)
    .bold(`${lo} to ${hi}`)
    .plain(`. That's about `);

  if (size.kind === 'multiple') {
    builder.bold(`${size.multiple}×`).plain(' your typical week.');
  } else {
    builder.bold(`${size.percent}%`).plain(` ${size.direction} your typical week.`);
  }

  return builder.build();
}

export interface LocationFlagFacts {
  location: string;
  count: number;
  usualRange: [number, number];
  eventType: EventType;
  windowEnd: string;
}

/** One of the two location states (§7): flagged. */
export function locationFlaggedSentence(facts: LocationFlagFacts): Parts {
  const [lo, hi] = facts.usualRange;
  const et = facts.eventType;
  return new PartsBuilder()
    .bold(`${facts.location} — ${facts.count} ${noun(et, facts.count)}`)
    .plain(` over the 4 weeks to ${formatDay(facts.windowEnd)}, against a usual `)
    .bold(`${lo} to ${hi}`)
    .plain('.')
    .build();
}

/** The locations-quiet line — no location was flagged. */
export function locationsQuietLine(locationCount: number, windowEnd: string): Parts {
  return new PartsBuilder()
    .plain(
      `Nothing unusual at any of your ${locationCount} locations over the 4 weeks to ` +
        `${formatDay(windowEnd)}.`,
    )
    .build();
}

/**
 * The other location state (§7): not enough history, listed by name so the quiet line never
 * covers them. PLAN.md §7 says only "listed by name" — no verbatim sentence exists to match, so
 * this exact phrasing is this task's own choice, not a reproduction of anything in the plan.
 */
export function locationsNotEnoughHistoryLine(locations: string[]): Parts {
  const list =
    locations.length <= 1
      ? locations.join('')
      : `${locations.slice(0, -1).join(', ')} and ${locations.at(-1)}`;
  return new PartsBuilder().plain(`Not enough history yet for ${list}.`).build();
}

/**
 * The in-progress line (D18, T9): a plain fact, never a verdict — no range, no percentage, no
 * comparison. `null` in, `null` out (T9's boundary case).
 */
export function inProgressLine(
  inProgress: { weekStart: string; daysIn: number; count: number } | null,
  asOfDate: string,
  eventType: EventType,
): Parts | null {
  if (!inProgress) {
    return null;
  }
  const dayWord = inProgress.daysIn === 1 ? 'day' : 'days';
  const range = formatInProgressRange(inProgress.weekStart, asOfDate);
  const builder = new PartsBuilder().plain('This week so far: ');
  if (inProgress.count === 0) {
    builder.bold(`no ${noun(eventType, 0)} yet`);
  } else {
    builder.bold(`${inProgress.count} ${noun(eventType, inProgress.count)}`);
  }
  builder.plain(`, ${inProgress.daysIn} ${dayWord} in ${range}.`);
  return builder.build();
}

function toMarkdown(parts: Parts): string {
  let result = '';
  let cursor = 0;
  for (const [start, end] of parts.emphasis) {
    result += parts.text.slice(cursor, start);
    result += `**${parts.text.slice(start, end)}**`;
    cursor = end;
  }
  result += parts.text.slice(cursor);
  return result;
}

/**
 * §8's seam: `explain(verdict, facts) -> string`. Droppable — the only implementation that
 * exists or needs to exist is this template; a future LLM provider would sit behind this same
 * signature, receiving exactly the §6 facts and never re-deriving the gate's numbers. Returns
 * markdown (`**bold**`) rather than `Parts` because the seam's contract is a plain string;
 * `verdictSentence` above is what T12 actually renders from.
 */
export function explain(facts: VerdictFacts): string {
  return toMarkdown(verdictSentence(facts));
}
