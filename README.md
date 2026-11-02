# f1-telemetry-2025

> 2025 Formula 1 telemetry dataset — [TracingInsights.com](https://tracinginsights.com/)

A structured JavaScript/Node.js package for loading the 2025 F1 season telemetry dataset.  
Covers **24 Grand Prix weekends + Pre-Season Testing** with full per-lap telemetry, lap times, weather, race control messages, and championship standings.

---

## Dataset Overview

| Scope | Detail |
|---|---|
| **Season** | 2025 Formula 1 World Championship |
| **Events** | 24 Grand Prix + Pre-Season Testing (25 total) |
| **Sessions per event** | Practice 1, Practice 2, Practice 3, Qualifying, Race |
| **Session-level data** | Drivers list, Weather time-series, Lap times (all drivers), Track corners, Race control messages |
| **Per-driver data** | Lap-by-lap metadata + high-frequency telemetry per lap |

### Telemetry Channels (per lap, high-frequency)

| Channel | Description |
|---|---|
| `time` | Elapsed seconds since lap start |
| `rpm` | Engine RPM |
| `speed` | Speed (km/h) |
| `gear` | Gear position (0 = neutral) |
| `throttle` | Throttle input 0–100 (%) |
| `brake` | Brake input (0/1) |
| `drs` | DRS state (0 = closed, 10/12/14 = open) |
| `distance` | Cumulative track distance (metres) |
| `rel_distance` | Relative distance 0.0–1.0 |
| `DriverAhead` | Code of car immediately ahead |
| `DistanceToDriverAhead` | Gap to car ahead (metres) |
| `acc_x` | Lateral G-force |
| `acc_y` | Longitudinal G-force |
| `acc_z` | Vertical G-force |
| `x`, `y`, `z` | Car position on track map |

### Lap Metadata Columns (per driver per lap)

`time`, `lap`, `compound`, `stint`, `s1`/`s2`/`s3` (sector times), `pos`, `fresh`, `pin`/`pout` (pit in/out), `wAT`/`wTT`/`wH`/`wR` (weather), `vi1`/`vi2`/`vfl`/`vst` (speed traps), `iacc` (incident count), and more.

---

## Requirements

- **Node.js >= 18** (uses `fs/promises` and `import.meta.url`)

---

## Usage

```js
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
```

### List all events

```js
const events = listEvents();
// ['Pre-Season Testing', 'Australian Grand Prix', ..., 'Abu Dhabi Grand Prix']
```

### Load session metadata

```js
const session = await getSession('Spanish Grand Prix', 'Race');

session.drivers    // { drivers: [{driver, team, dn, fn, ln, tc, url}, ...] }
session.weather    // { wT, wAT, wH, wP, wR, wTT, wWD, wWS } — time-series arrays
session.laptimes   // columnar lap data for all drivers
session.corners    // { CornerNumber, X, Y, Angle, Distance }
session.rcm        // { time, cat, msg, flag, scope, ... } — race control messages
```

### Load a driver's lap-by-lap metadata

```js
const laps = await getDriverLaptimes('Spanish Grand Prix', 'Race', 'VER');
// { time: [...], lap: [...], compound: [...], s1: [...], pos: [...], wAT: [...], ... }

laps.time.forEach((t, i) => {
  console.log(`Lap ${laps.lap[i]}: ${t.toFixed(3)}s on ${laps.compound[i]}`);
});
```

### Load high-frequency telemetry for a driver

```js
const telemetry = await getDriverTelemetry('Spanish Grand Prix', 'Race', 'VER');
// Returns: { 1: { time, speed, rpm, gear, throttle, brake, drs, ... },
//            2: { ... }, ... }

const lap10 = telemetry[10];
console.log(`Top speed: ${Math.max(...lap10.speed)} km/h`);
```

### Load a full race weekend

```js
const weekend = await getWeekend('Monaco Grand Prix');
// { 'Practice 1': {...}, 'Practice 2': {...}, ..., 'Race': {...} }
```

### Load telemetry for all drivers in a session

```js
const allTel = await getAllDriversTelemetry('Spanish Grand Prix', 'Race');
// { VER: { 1: {...}, 2: {...}, ... }, NOR: { ... }, HAM: { ... }, ... }
```

### Load championship standings

```js
const standings = await getStandings();
standings.drivers.forEach(d =>
  console.log(`P${d.position}: ${d.driver} — ${d.points} pts`)
);
```

---

## Building a Training Dataset

```js
import { getSession, getDriverLaptimes, getDriverTelemetry } from './index.js';

const session = await getSession('Spanish Grand Prix', 'Race');
const drivers = session.drivers.drivers.map(d => d.driver);

const rows = [];
for (const code of drivers) {
  const laps    = await getDriverLaptimes('Spanish Grand Prix', 'Race', code);
  const telAll  = await getDriverTelemetry('Spanish Grand Prix', 'Race', code);
  if (!laps || !telAll) continue;

  for (let i = 0; i < laps.time.length; i++) {
    const lapNum = laps.lap[i];
    const tel    = telAll[lapNum];
    if (!tel) continue;

    rows.push({
      driver:       code,
      lap:          lapNum,
      lap_time_s:   laps.time[i],
      compound:     laps.compound[i],
      position:     laps.pos[i],
      s1:           laps.s1?.[i],
      s2:           laps.s2?.[i],
      s3:           laps.s3?.[i],
      fresh_tyre:   laps.fresh?.[i],
      pit_in:       laps.pin?.[i],
      pit_out:      laps.pout?.[i],
      air_temp_c:   laps.wAT?.[i],
      track_temp_c: laps.wTT?.[i],
      humidity_pct: laps.wH?.[i],
      rainfall:     laps.wR?.[i],
      // Telemetry aggregates
      top_speed_kph: Math.max(...tel.speed),
      avg_throttle:  tel.throttle.reduce((a,b) => a+b, 0) / tel.throttle.length,
      drs_pct:       tel.drs.filter(d => d > 0).length / tel.time.length,
      max_lat_g:     Math.max(...tel.acc_x.map(Math.abs)),
      max_lon_g:     Math.max(...tel.acc_y.map(Math.abs)),
    });
  }
}

console.log(`Rows: ${rows.length}`);
```

---

## File Structure

```
2025/
├── package.json               ← npm package manifest
├── index.js                   ← main package loader (this file)
├── schema.json                ← JSON Schema for all data types
├── example.js                 ← runnable usage examples
├── standings.json             ← championship standings
│
├── Spanish Grand Prix/
│   ├── Practice 1/
│   │   ├── drivers.json
│   │   ├── weather.json
│   │   ├── session_laptimes.json
│   │   ├── corners.json
│   │   ├── rcm.json
│   │   ├── VER/
│   │   │   ├── laptimes.json
│   │   │   ├── 1_tel.json
│   │   │   ├── 2_tel.json
│   │   │   └── ...
│   │   └── NOR/ ...
│   ├── Practice 2/ ...
│   ├── Practice 3/ ...
│   ├── Qualifying/ ...
│   └── Race/ ...
│
├── Monaco Grand Prix/ ...
└── ... (24 GPs total + Pre-Season Testing)
```

---

## Data Source

- Raw telemetry: [TracingInsights.com](https://tracinginsights.com/) via [FastF1](https://github.com/theOehrly/Fast-F1)
- Visualize live at: [f1tel.com](https://f1tel.com/)

---

## License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — Attribution required.
