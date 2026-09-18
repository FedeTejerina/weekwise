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
          env: { TZ },
          setupFiles: ['./test/setup/pg-timestamp-parser.ts'],
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
