import { loadDb, replaceDb, flush } from './db';
import { seedDatabase } from './seed';

const before = loadDb(seedDatabase);
// Keep instructor-managed portal settings (such as the navigation video) across a demo reset.
const next = seedDatabase();
if (before.settings) next.settings = before.settings;
replaceDb(next);
flush();
console.log('Demo data has been reset.');
process.exit(0);
