import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import {
  fetchWeeklyCheckData,
  locationNamesFor,
  weekListFrom,
  weeklyCheck,
  type EventType,
} from './weeklyCheck.js';

const VALID_EVENT_TYPES: readonly EventType[] = ['call_received', 'lead_created', 'appointment_set'];
const DEFAULT_EVENT_TYPE: EventType = 'call_received';

/**
 * D15: invalid or out-of-range `account`/`type`/`week` fall back to the defaults — first
 * account, `call_received`, that account's latest completed week — rather than a 400.
 * `querystring` is deliberately left un-schema'd (`{}`): a strict integer/enum schema would
 * make Fastify itself reject bad input with a 400 before this handler ever ran, which is
 * exactly what D15 rules out.
 */
export function buildApp(pool: Pool): FastifyInstance {
  const app = Fastify();

  app.get(
    '/api/accounts',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                timezone: { type: 'string' },
                locationCount: { type: 'number' },
              },
              required: ['id', 'name', 'timezone', 'locationCount'],
            },
          },
        },
      },
    },
    async () => {
      const data = await fetchWeeklyCheckData(pool);
      return data.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        timezone: account.timezone,
        locationCount: locationNamesFor(data, account.id).length,
      }));
    },
  );

  app.get('/api/weekly-check', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const data = await fetchWeeklyCheckData(pool);

    // An unseeded database (`db:migrate up` with no `db:seed`) has no accounts at all — there
    // is no "first account" to fall back to, so this can't be a D15 fallback; it's a genuinely
    // different, handled response rather than the crash `data.accounts[0]!` would otherwise be
    // (R1 #9).
    if (data.accounts.length === 0) {
      reply.code(503);
      return { error: 'No accounts are seeded yet. Run `npm run db:setup`.' };
    }

    const requestedAccountId = Number(query.account);
    const accountExists = data.accounts.some((a) => a.id === requestedAccountId);
    const accountId = accountExists ? requestedAccountId : data.accounts[0]!.id;

    const requestedEventType = query.type;
    const eventType = VALID_EVENT_TYPES.includes(requestedEventType as EventType)
      ? (requestedEventType as EventType)
      : DEFAULT_EVENT_TYPE;

    const range = data.ranges.find((r) => r.accountId === accountId)!;
    const weeks = weekListFrom(range.earliestFullWeek, range.defaultWeek);
    const requestedWeek = typeof query.week === 'string' ? query.week : '';
    const weekStart = weeks.includes(requestedWeek) ? requestedWeek : range.defaultWeek;

    return weeklyCheck(pool, accountId, eventType, weekStart);
  });

  return app;
}
