/**
 * example.js — f1-telemetry-2025 usage examples
 * ================================================
 * Run with: node example.js
 *
 * Demonstrates how to:
 *  1. Load session metadata (drivers, weather, race control)
 *  2. Load lap times for a driver
 *  3. Load raw telemetry for a specific lap
 *  4. Build a flat training dataset from a session
 *  5. Load championship standings
 */

import {
  getSession,
  getDriverTelemetry,
  getDriverLaptimes,
  getStandings,
  getWeekend,
  getAllDriversTelemetry,
  listEvents,
  EVENTS,
  SESSIONS,
  TELEMETRY_CHANNELS,
} from './index.js';

// ─── 1. List available events ─────────────────────────────────────────────────
console.log('=== Available Events ===');
console.log(listEvents().join('\n'));

// ─── 2. Load session metadata ─────────────────────────────────────────────────
console.log('\n=== Spanish GP Race Session ===');
const session = await getSession('Spanish Grand Prix', 'Race');
console.log(`Drivers (${session.drivers?.drivers?.length}):`);
session.drivers?.drivers?.forEach((d) =>
  console.log(`  #${d.dn.padStart(2)} ${d.fn} ${d.ln} (${d.driver}) — ${d.team}`)
);
console.log(`Weather samples: ${session.weather?.wAT?.length}`);
console.log(`Race control messages: ${session.rcm?.msg?.length}`);

// ─── 3. Load driver lap times ─────────────────────────────────────────────────
console.log('\n=== VER Lap Times (Spanish GP Race) ===');
const verLaps = await getDriverLaptimes('Spanish Grand Prix', 'Race', 'VER');
console.log(`Total laps: ${verLaps?.time?.length}`);
verLaps?.time?.forEach((t, i) => {
  const lapNum = verLaps.lap[i];
  const compound = verLaps.compound[i];
  const pos = verLaps.pos[i];
  console.log(`  Lap ${String(lapNum).padStart(2)}: ${t.toFixed(3)}s | ${compound} | P${pos}`);
});

// ─── 4. Load telemetry for a specific lap ─────────────────────────────────────
console.log('\n=== VER Lap 1 Telemetry (Spanish GP Race) ===');
const allTel = await getDriverTelemetry('Spanish Grand Prix', 'Race', 'VER');
const lap1 = allTel?.[1];
if (lap1) {
  console.log(`Samples: ${lap1.time?.length}`);
  console.log(`Top speed: ${Math.max(...lap1.speed).toFixed(1)} km/h`);
  console.log(`Max RPM:   ${Math.max(...lap1.rpm)}`);
  const drsActive = lap1.drs?.filter((d) => d > 0).length ?? 0;
  console.log(`DRS open:  ${drsActive} samples`);
}

// ─── 5. Build flat training rows from a session ───────────────────────────────
console.log('\n=== Building Training Dataset (Spanish GP Race) ===');
const driverCodes = session.drivers?.drivers?.map((d) => d.driver) ?? [];
const trainingRows = [];

for (const code of driverCodes.slice(0, 3)) { // limit to 3 drivers for demo
  const laptimes = await getDriverLaptimes('Spanish Grand Prix', 'Race', code);
  const telemetry = await getDriverTelemetry('Spanish Grand Prix', 'Race', code);
  if (!laptimes || !telemetry) continue;

  for (let i = 0; i < laptimes.time.length; i++) {
    const lapNum = laptimes.lap[i];
    const lapTel = telemetry[lapNum];
    if (!lapTel) continue;

    trainingRows.push({
      driver:       code,
      lap:          lapNum,
      lap_time_s:   laptimes.time[i],
      compound:     laptimes.compound[i],
      stint:        laptimes.stint[i],
      position:     laptimes.pos[i],
      s1:           laptimes.s1?.[i] ?? null,
      s2:           laptimes.s2?.[i] ?? null,
      s3:           laptimes.s3?.[i] ?? null,
      fresh_tyre:   laptimes.fresh?.[i] ?? null,
      pit_in:       laptimes.pin?.[i] ?? false,
      pit_out:      laptimes.pout?.[i] ?? false,
      air_temp_c:   laptimes.wAT?.[i] ?? null,
      track_temp_c: laptimes.wTT?.[i] ?? null,
      humidity_pct: laptimes.wH?.[i] ?? null,
      rainfall:     laptimes.wR?.[i] ?? false,
      // Aggregate telemetry features per lap
      tel_samples:   lapTel.time?.length ?? 0,
      top_speed_kph: Math.max(...(lapTel.speed ?? [0])),
      max_rpm:       Math.max(...(lapTel.rpm ?? [0])),
      avg_throttle:  lapTel.throttle?.reduce((a, b) => a + b, 0) / (lapTel.throttle?.length || 1),
      drs_pct:       ((lapTel.drs?.filter((d) => d > 0).length ?? 0) / (lapTel.time?.length || 1)),
      max_lat_g:     Math.max(...(lapTel.acc_x?.map(Math.abs) ?? [0])),
      max_lon_g:     Math.max(...(lapTel.acc_y?.map(Math.abs) ?? [0])),
    });
  }
}

console.log(`Training rows generated: ${trainingRows.length}`);
console.log('Sample row:', JSON.stringify(trainingRows[0], null, 2));

// ─── 6. Championship standings ────────────────────────────────────────────────
console.log('\n=== Standings ===');
const standings = await getStandings();
console.log(`Season: ${standings.season}`);
standings.drivers?.slice(0, 5).forEach((d) =>
  console.log(`  P${d.position}: ${d.driver} — ${d.points} pts`)
);
