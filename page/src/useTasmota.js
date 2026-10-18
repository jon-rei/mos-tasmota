// Shared data layer for the widget and the plugin page.
//
// Settings are stored through the MOS plugin settings API:
//   GET/POST /api/v1/mos/plugins/settings/tasmota-energy
// (persisted by MOS at /boot/optional/plugins/tasmota-energy/settings.json,
// which is also what the server-side script reads).
//
// Energy data is polled server-side: stock Tasmota firmware does not send
// CORS headers, so the browser cannot query the device directly. Instead
// the frontend runs the plugin's tasmota-energy-query script through the
// MOS query API, which only executes binaries in /usr/bin/plugins/:
//   POST /api/v1/mos/plugins/query
//   { command: "tasmota-energy-query", args: [], timeout: 15, parse_json: true }
import { ref } from 'vue';

export const PLUGIN = 'tasmota-energy';

export const DEFAULT_SETTINGS = {
  interval: 5, // seconds
  price: 0, // per kWh
  currency: 'EUR',
  devices: [], // { name, ip, user, password }
};

const authHeaders = () => ({
  Authorization: 'Bearer ' + localStorage.getItem('authToken'),
});

export async function loadSettings() {
  try {
    const res = await fetch(`/api/v1/mos/plugins/settings/${PLUGIN}`, { headers: authHeaders() });
    if (!res.ok) return { ...DEFAULT_SETTINGS };
    const data = await res.json();
    return {
      ...DEFAULT_SETTINGS,
      ...data,
      devices: Array.isArray(data?.devices) ? data.devices : [],
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings) {
  const res = await fetch(`/api/v1/mos/plugins/settings/${PLUGIN}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return res.ok;
}

// Run bin/tasmota-energy-query on the MOS host.
//   queryDevices()             -> poll all devices from settings.json
//   queryDevices([ip, user, password]) -> test one device before saving
// Returns the script's output object {ok, devices, totals} / {ok, error}.
export async function queryDevices(args = []) {
  const res = await fetch('/api/v1/mos/plugins/query', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'tasmota-energy-query', args, timeout: 15, parse_json: true }),
  });
  if (!res.ok) {
    const err = new Error('query_failed');
    err.status = res.status;
    throw err;
  }
  const envelope = await res.json();
  if (!envelope.success) {
    const err = new Error(typeof envelope.output === 'string' && envelope.output ? envelope.output : 'query_failed');
    throw err;
  }
  const out = envelope.output;
  if (!out || typeof out !== 'object') throw new Error('query_failed');
  if (out.ok === false) throw new Error(out.error || 'query_failed');
  return out;
}

export function useTasmota() {
  const loading = ref(true);
  const error = ref(null); // null | 'forbidden' | 'failed' | <message>
  const results = ref([]); // per-device result objects from the script
  const totals = ref(null);
  const lastUpdate = ref(null);

  const run = async () => {
    try {
      const out = await queryDevices();
      results.value = out.devices || [];
      totals.value = out.totals || null;
      error.value = null;
    } catch (e) {
      error.value = e.status === 403 ? 'forbidden' : e.message || 'failed';
    } finally {
      loading.value = false;
      lastUpdate.value = new Date();
    }
  };

  // Callers (poll timer, refresh button, save) share one in-flight query
  // instead of starting another script run on the MOS host.
  let inflight = null;
  const refresh = () => {
    if (!inflight) inflight = run().finally(() => (inflight = null));
    return inflight;
  };

  return { loading, error, results, totals, lastUpdate, refresh };
}

// Poll while the page is visible; pauses in background tabs. The next run is
// scheduled only after the previous one finished, so slow or unreachable
// devices can't pile up script runs on the MOS host.
export function usePolling(fn, seconds) {
  let timer = null; // pending timeout; null while a run is in progress
  let ms = 0;
  let generation = 0; // bumped by start/stop so stale runs don't reschedule

  const run = async (gen) => {
    timer = null;
    if (!document.hidden) {
      try {
        await fn();
      } catch {
        // fn reports its own errors; keep polling
      }
    }
    if (gen === generation) timer = setTimeout(() => run(gen), ms);
  };

  const onVisible = () => {
    // Refresh right away when the tab comes back, unless a run is in progress.
    if (!document.hidden && timer) {
      clearTimeout(timer);
      run(generation);
    }
  };

  return {
    start(sec = seconds) {
      this.stop();
      ms = Math.max(2, Number(sec) || 5) * 1000;
      const gen = generation;
      timer = setTimeout(() => run(gen), ms);
      document.addEventListener('visibilitychange', onVisible);
    },
    stop() {
      generation++;
      if (timer) clearTimeout(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisible);
    },
  };
}

// Formatting helpers shared by the widget and the plugin page.
export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const fmt = (v, digits = 2) => {
  const n = num(v);
  return n === null ? '-' : n.toFixed(digits);
};

// Translate an error code from the script or query layer. Unknown errors
// (e.g. raw output of a failed query) fall back to the generic message.
export const errorText = (t, code) => {
  if (code === 'forbidden') return t('plugin_tasmota_energy.forbidden');
  const key = `plugin_tasmota_energy.errors.${code}`;
  const text = code ? t(key) : key;
  if (text !== key) return text;
  const generic = t('plugin_tasmota_energy.load_failed');
  return code && code !== 'query_failed' && code !== 'failed' ? `${generic} (${code})` : generic;
};

// cost for a kWh value: '-' when no price is configured, else price * kWh
export const cost = (settings, kwh) => {
  const price = num(settings.price);
  const k = num(kwh);
  if (price === null || price <= 0 || k === null) return null;
  return price * k;
};
