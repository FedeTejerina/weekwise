// Connection for node-pg-migrate. Matches compose.yaml's `db` service exactly, so
// `docker compose up -d && npm run db:migrate up` works with no other setup. Set DB_PORT
// if 5432 is already taken on the host — same override compose.yaml reads.
export default {
  db: {
    host: 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'weekwise',
  },
};
