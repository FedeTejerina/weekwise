import { buildApp } from './api.js';
import { pool } from './db/pool.js';

const app = buildApp(pool);
const port = Number(process.env.PORT) || 3000;

app.listen({ port }, (error, address) => {
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`listening on ${address}`);
});
