import type { Parts } from '../../server/src/wording.js';

/** Renders T10's `Parts` — `emphasis` ranges become `<strong>`. Nothing here parses markdown;
 * the ranges are the only signal, per T10's own return-shape rule. */
export function Emphasized({ parts }: { parts: Parts }) {
  const { text, emphasis } = parts;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  emphasis.forEach(([start, end], i) => {
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }
    nodes.push(<strong key={i}>{text.slice(start, end)}</strong>);
    cursor = end;
  });
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return <>{nodes}</>;
}
