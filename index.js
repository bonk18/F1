/**
 * f1-telemetry-2025
 * =================
 * 2025 Formula 1 telemetry dataset — TracingInsights.com
 *
 * Usage:
 *   import { getSession, getDriverTelemetry, getDriverLaptimes,
 *            getStandings, listEvents, EVENTS, SESSIONS } from './index.js';
 *
 * All data is loaded lazily (on demand) via dynamic import so you only
 * pay the cost of reading files you actually need.
 */

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let customDataDir = null;

/**
 * Configure a custom path to the dataset directory.
 * @param {string} dir
 */
export function setDataDir(dir) {
  customDataDir = dir;
}

/**
 * Resolve the directory containing the dataset files.
 * Checks customDataDir, process.env.F1_DATA_DIR, ./2025 subfolder, then falls back to __dirname.
 * @returns {string}
 */
export function getDataDir() {
  if (customDataDir) return customDataDir;
  if (process.env.F1_DATA_DIR) return path.resolve(process.env.F1_DATA_DIR);
  const nested2025 = path.join(__dirname, '2025');
  if (existsSync(nested2025)) return nested2025;
  return __dirname;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * All 24 Grand Prix events + Pre-Season Testing available in the 2025 dataset.
 * Listed in calendar order.
 */
export const EVENTS = [
  'Pre-Season Testing',
  'Australian Grand Prix',
  'Chinese Grand Prix',
  'Japanese Grand Prix',
  'Bahrain Grand Prix',
  'Saudi Arabian Grand Prix',
  'Miami Grand Prix',
  'Emilia Romagna Grand Prix',
  'Monaco Grand Prix',
  'Spanish Grand Prix',
  'Canadian Grand Prix',
  'Austrian Grand Prix',
  'British Grand Prix',
  'Belgian Grand Prix',
  'Hungarian Grand Prix',
  'Dutch Grand Prix',
  'Italian Grand Prix',
  'Azerbaijan Grand Prix',
  'Singapore Grand Prix',
  'United States Grand Prix',
  'Mexico City Grand Prix',
  'São Paulo Grand Prix',
  'Las Vegas Grand Prix',
  'Qatar Grand Prix',
  'Abu Dhabi Grand Prix',
];

/**
 * Available session types within each event weekend.
 */
export const SESSIONS = [
  'Practice 1',
  'Practice 2',
  'Practice 3',
  'Qualifying',
  'Race',
];

/**
 * Telemetry channel descriptions.
 * Each per-lap telemetry file (`<lap>_tel.json`) contains these columns
 * under the `tel` key, each as a parallel array indexed by sample.
 */
export const TELEMETRY_CHANNELS = {
  time:                   'Elapsed time in seconds since lap start',
  rpm:                    'Engine RPM',
  speed:                  'Speed in km/h',
  gear:                   'Gear position (0 = neutral)',
  throttle:               'Throttle input 0–100 (%)',
  brake:                  'Brake input (boolean or 0/1)',
  drs:                    'DRS state (0 = closed, 10/12/14 = open)',
  distance:               'Cumulative track distance in metres',
  rel_distance:           'Relative track distance 0.0–1.0',
  DriverAhead:            'Driver code of the car immediately ahead',
  DistanceToDriverAhead:  'Gap to the car ahead in metres',
  acc_x:                  'Lateral G-force (left/right)',
  acc_y:                  'Longitudinal G-force (accel/braking)',
  acc_z:                  'Vertical G-force (bumps)',
  x:                      'Car X position on track map',
  y:                      'Car Y position on track map',
  z:                      'Car Z altitude',
  dataKey:                'Internal FastF1 data reference key',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the absolute filesystem path for a given event/session.
 * @param {string} event   - e.g. "Spanish Grand Prix"
 * @param {string} session - e.g. "Race"
 * @returns {string} absolute path to the session directory
 */
function sessionPath(event, session) {
  return path.join(getDataDir(), event, session);
}

/**
 * Read and parse a JSON file. Returns null if the file does not exist.
 * @param {string} filePath
 * @returns {Promise<any|null>}
 */
async function readJSON(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * List all events available in the dataset.
 * @returns {string[]}
 */
export function listEvents() {
  return [...EVENTS];
}

/**
 * List all sessions available for a given event.
 * @param {string} event
 * @returns {string[]}
 */
export function listSessions(event) {
  if (!EVENTS.includes(event)) {
    throw new Error(`Unknown event: "${event}". Use listEvents() to see valid names.`);
  }
  return [...SESSIONS];
}

/**
 * Load session-level data for an event weekend session.
 *
 * Returns an object with the following keys (each may be null if data is missing):
 *  - `drivers`       — list of drivers who participated
 *  - `weather`       — time-series weather data
 *  - `laptimes`      — aggregated lap times for all drivers
 *  - `corners`       — corner map data (number, X, Y, angle, distance)
 *  - `rcm`           — race control messages
 *
 * @param {string} event   - e.g. "Spanish Grand Prix"
 * @param {string} session - e.g. "Race" | "Qualifying" | "Practice 1"
 * @returns {Promise<{drivers, weather, laptimes, corners, rcm}>}
 */
export async function getSession(event, session) {
  const dir = sessionPath(event, session);
  const [drivers, weather, laptimes, corners, rcm] = await Promise.all([
    readJSON(path.join(dir, 'drivers.json')),
    readJSON(path.join(dir, 'weather.json')),
    readJSON(path.join(dir, 'session_laptimes.json')),
    readJSON(path.join(dir, 'corners.json')),
    readJSON(path.join(dir, 'rcm.json')),
  ]);

  return {
    event,
    session,
    drivers,
    weather,
    laptimes,
    corners,
    rcm,
  };
}

/**
 * Load per-lap telemetry for a specific driver in a session.
 *
 * Each lap is keyed by lap number (1-indexed). Each value is the `tel` object
 * containing parallel arrays for every telemetry channel. See TELEMETRY_CHANNELS
 * for full channel descriptions.
 *
 * @param {string} event       - e.g. "Spanish Grand Prix"
 * @param {string} session     - e.g. "Race"
 * @param {string} driverCode  - 3-letter code, e.g. "VER", "NOR", "HAM"
 * @returns {Promise<Record<number, TelemetryLap>|null>}
 */
export async function getDriverTelemetry(event, session, driverCode) {
  const dir = path.join(sessionPath(event, session), driverCode.toUpperCase());

  let lap = 1;
  const result = {};
  while (true) {
    const data = await readJSON(path.join(dir, `${lap}_tel.json`));
    if (data === null) break;
    result[lap] = data.tel ?? data;
    lap++;
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Load per-lap metadata for a specific driver (lap times, compounds, sector
 * times, position, weather readings merged per lap, etc.)
 *
 * Fields returned per lap:
 *  time, lap, compound, stint, s1/s2/s3 (sector times), ms1/ms2/ms3 (mini sectors),
 *  pos (position), status, pb (personal best), fresh (fresh tyre flag), team,
 *  pin/pout (pit in/out laps), vi1/vi2/vfl/vst (speed trap readings),
 *  wT/wAT/wH/wP/wR/wTT/wWD/wWS (weather at lap time), iacc (incident count), etc.
 *
 * @param {string} event       - e.g. "Spanish Grand Prix"
 * @param {string} session     - e.g. "Race"
 * @param {string} driverCode  - 3-letter code, e.g. "VER"
 * @returns {Promise<object|null>}
 */
export async function getDriverLaptimes(event, session, driverCode) {
  const dir = path.join(sessionPath(event, session), driverCode.toUpperCase());
  return readJSON(path.join(dir, 'laptimes.json'));
}

/**
 * Load championship standings data.
 * Returns drivers and constructors standings with full stats.
 *
 * @returns {Promise<{last_updated: string, season: string, drivers: Driver[], teams: Team[]}>}
 */
export async function getStandings() {
  return readJSON(path.join(getDataDir(), 'standings.json'));
}

/**
 * Load ALL session data for a full race weekend (all 5 sessions).
 * This is a convenience wrapper that calls getSession() for every session.
 *
 * @param {string} event - e.g. "Spanish Grand Prix"
 * @returns {Promise<Record<string, SessionData>>}
 */
export async function getWeekend(event) {
  const sessions = await Promise.all(
    SESSIONS.map((s) => getSession(event, s))
  );
  return Object.fromEntries(sessions.map((s) => [s.session, s]));
}

/**
 * Load all telemetry for every driver in a session.
 * Useful for building training datasets across a full grid.
 *
 * @param {string} event
 * @param {string} session
 * @returns {Promise<Record<string, Record<number, TelemetryLap>>>}
 */
export async function getAllDriversTelemetry(event, session) {
  const sessionData = await getSession(event, session);
  const driverCodes = sessionData.drivers?.drivers?.map((d) => d.driver) ?? [];

  const entries = await Promise.all(
    driverCodes.map(async (code) => {
      const tel = await getDriverTelemetry(event, session, code);
      return [code, tel];
    })
  );

  return Object.fromEntries(entries.filter(([, v]) => v !== null));
}
