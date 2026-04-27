const FROZEN_RESULTS_PATH = '/frozen-results.json';

let snapshotCache = null;
let snapshotLoadPromise = null;

function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Ugyldig frozen-results.json (forventet objekt).');
  }

  const classes = Array.isArray(raw.classes) ? raw.classes : [];
  const standings = Array.isArray(raw.standings) ? raw.standings : [];
  const resultsTable = raw.results_table && typeof raw.results_table === 'object'
    ? raw.results_table
    : { table: {}, edit_counts: {}, base_date: '2026-04-13' };
  const logos = raw.logos && typeof raw.logos === 'object' ? raw.logos : {};
  const appConfig = raw.app_config && typeof raw.app_config === 'object'
    ? raw.app_config
    : { app_mode: 'archived', simulation_enabled: false, frozen: true };

  return {
    ...raw,
    classes,
    standings,
    results_table: {
      table: resultsTable.table && typeof resultsTable.table === 'object' ? resultsTable.table : {},
      edit_counts: resultsTable.edit_counts && typeof resultsTable.edit_counts === 'object' ? resultsTable.edit_counts : {},
      base_date: typeof resultsTable.base_date === 'string' ? resultsTable.base_date : '2026-04-13',
    },
    logos,
    app_config: {
      app_mode: appConfig.app_mode || 'archived',
      simulation_enabled: Boolean(appConfig.simulation_enabled),
      frozen: true,
    },
  };
}

export async function loadFrozenResultsSnapshot(force = false) {
  if (!force && snapshotCache) {
    return snapshotCache;
  }

  if (!force && snapshotLoadPromise) {
    return snapshotLoadPromise;
  }

  snapshotLoadPromise = fetch(FROZEN_RESULTS_PATH, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Kunne ikke hente ${FROZEN_RESULTS_PATH} (${res.status})`);
      }
      return res.json();
    })
    .then((raw) => {
      const normalized = normalizeSnapshot(raw);
      snapshotCache = normalized;
      return normalized;
    })
    .finally(() => {
      snapshotLoadPromise = null;
    });

  return snapshotLoadPromise;
}

export async function fetchFrozenStandings() {
  const snapshot = await loadFrozenResultsSnapshot();
  return snapshot.standings;
}

export async function fetchFrozenResultsTable() {
  const snapshot = await loadFrozenResultsSnapshot();
  return snapshot.results_table;
}

export async function fetchFrozenClasses() {
  const snapshot = await loadFrozenResultsSnapshot();
  return snapshot.classes;
}

export async function fetchFrozenLogoMap(force = false) {
  const snapshot = await loadFrozenResultsSnapshot(force);
  return snapshot.logos;
}

export async function fetchFrozenAppConfig() {
  const snapshot = await loadFrozenResultsSnapshot();
  return snapshot.app_config;
}
