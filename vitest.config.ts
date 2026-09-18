import { defineConfig } from 'vitest/config';

const TZ = 'America/Los_Angeles';

export default defineConfig({
  test: {
    projects: [
      {
        root: './server',
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
          env: { TZ },
        },
      },
      {
        root: './server',
        test: {
          name: 'sql',
          include: ['test/sql/**/*.test.ts'],
          environment: 'node',
          // Defaults to America/Los_Angeles like every other project, but — unlike them —
          // an ambient TZ is allowed through rather than overridden: T14 needs `TZ=UTC
          // npm test -- sql` to actually run under UTC, to prove the bucketing SQL gives
          // identical results either way rather than happening to work under one timezone.
          env: { TZ: process.env.TZ ?? TZ },
          setupFiles: ['./test/setup/pg-timestamp-parser.ts'],
          globalSetup: ['./test/sql/global-setup.ts'],
          // Starting the Postgres container, running migrations and seeding can take a while
          // on a cold image pull; the default 10s hook timeout isn't enough for that.
          hookTimeout: 120_000,
        },
      },
      {
        root: './server',
        test: {
          name: 'api',
          include: ['test/api/**/*.test.ts'],
          environment: 'node',
          env: { TZ },
          setupFiles: ['./test/setup/pg-timestamp-parser.ts'],
        },
      },
      {
        root: './web',
        test: {
          name: 'web',
          include: ['test/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          env: { TZ },
        },
      },
    ],
  },
});
