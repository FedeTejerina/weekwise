import { pool } from '../server/src/db/pool.js';
import { weeklyCheck, type EventType } from '../server/src/weeklyCheck.js';

async function main() {
  const [accountArg, typeArg, weekArg] = process.argv.slice(2);
  if (!accountArg || !typeArg || !weekArg) {
    console.error('usage: check.ts <account> <type> <week>');
    process.exitCode = 1;
    return;
  }

  const result = await weeklyCheck(pool, Number(accountArg), typeArg as EventType, weekArg);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
