// wave69/track_a/live_run.mjs — one live Track A run, persisted + verified.
// Usage: CLOUDFLARE_API_TOKEN=... node track_a/live_run.mjs <accountId>
import { runTrackA, persistRun } from './run_track_a.mjs';

const accountId = process.argv[2];
const result = await runTrackA({ accountId, live: true });
const saved = persistRun(result, new URL('./receipts/', import.meta.url).pathname);

console.log('status:', result.status);
console.log('round:', result.round, '| proximity:', result.proximity?.toFixed(4));
console.log('die interventions:', result.dieInterventions);
console.log('ledger verify:', JSON.stringify(saved.verify));
console.log('cumulative cost (sticky, full chain):', saved.cumulativeCost, 'ms');
console.log('scars:', saved.scars);
console.log('receipts file:', saved.file);
