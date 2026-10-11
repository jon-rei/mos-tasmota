<template>
  <div style="margin-bottom: 80px">
    <h2 class="mb-4">{{ $t('plugin_tasmota_energy.title') }}</h2>

    <v-card class="mb-4 pa-0">
      <v-card-title>{{ $t('plugin_tasmota_energy.settings') }}</v-card-title>
      <v-card-text class="pa-4">
        <v-row dense>
          <v-col cols="12" sm="4" md="2">
            <v-text-field
              v-model.number="form.interval"
              type="number"
              min="2"
              :label="$t('plugin_tasmota_energy.interval')"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
          <v-col cols="6" sm="4" md="2">
            <v-text-field
              v-model.number="form.price"
              type="number"
              min="0"
              step="0.01"
              :suffix="form.currency"
              :label="$t('plugin_tasmota_energy.price')"
              :hint="$t('plugin_tasmota_energy.price_hint')"
              persistent-hint
              :error-messages="priceError ? [$t('plugin_tasmota_energy.price_error')] : []"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="6" sm="4" md="2">
            <v-text-field
              v-model="form.currency"
              :label="$t('plugin_tasmota_energy.currency')"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
        </v-row>

        <div class="text-subtitle-2 mt-6 mb-2">{{ $t('plugin_tasmota_energy.devices') }}</div>
        <v-card
          v-for="(device, i) in form.devices"
          :key="i"
          variant="outlined"
          class="mb-3"
        >
          <v-card-text class="pa-3">
            <v-row dense>
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="device.name"
                  :label="$t('plugin_tasmota_energy.device_name')"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="device.ip"
                  :label="$t('plugin_tasmota_energy.device_ip')"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model="device.user"
                  :label="$t('plugin_tasmota_energy.device_user')"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model="device.password"
                  type="password"
                  :label="$t('plugin_tasmota_energy.device_password')"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="2" class="d-flex align-center" style="gap: 4px">
                <v-btn
                  size="small"
                  variant="tonal"
                  :loading="testState[i] === 'testing'"
                  :disabled="!device.ip"
                  @click="testDevice(i)"
                >
                  {{ testState[i] === 'testing' ? $t('plugin_tasmota_energy.testing') : $t('plugin_tasmota_energy.test') }}
                </v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  icon="mdi-delete"
                  color="error"
                  :title="$t('plugin_tasmota_energy.remove_device')"
                  @click="form.devices.splice(i, 1)"
                />
              </v-col>
            </v-row>
            <div v-if="testMsg[i]" class="text-body-2 mt-2" :class="testState[i] === 'ok' ? 'text-success' : 'text-error'">
              {{ testMsg[i] }}
            </div>
          </v-card-text>
        </v-card>

        <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="form.devices.push({ name: '', ip: '', user: '', password: '' })">
          {{ $t('plugin_tasmota_energy.add_device') }}
        </v-btn>

        <div class="d-flex align-center mt-6" style="gap: 12px">
          <v-btn color="primary" :loading="saving" prepend-icon="mdi-content-save" @click="save">
            {{ $t('plugin_tasmota_energy.save') }}
          </v-btn>
          <span v-if="saved" class="text-body-2 text-success">{{ $t('plugin_tasmota_energy.saved') }}</span>
          <span v-if="saveFailed" class="text-body-2 text-error">{{ $t('plugin_tasmota_energy.save_failed') }}</span>
        </div>
      </v-card-text>
    </v-card>

    <v-card class="mb-4 pa-0">
      <v-card-title class="d-flex align-center">
        {{ $t('plugin_tasmota_energy.live_data') }}
        <v-spacer />
        <v-btn
          size="small"
          variant="text"
          icon="mdi-refresh"
          :title="$t('plugin_tasmota_energy.refresh')"
          @click="refresh()"
        />
      </v-card-title>
      <v-card-text class="pa-4">
        <div v-if="loading" class="d-flex justify-center pa-4">
          <v-progress-circular indeterminate size="24" width="2" />
        </div>
        <div v-else-if="error" class="text-body-2 text-medium-emphasis">
          {{ error === 'forbidden' ? $t('plugin_tasmota_energy.forbidden') : $t('plugin_tasmota_energy.load_failed') }}
        </div>
        <div v-else-if="results.length === 0" class="text-body-2 text-medium-emphasis">
          {{ $t('plugin_tasmota_energy.no_devices') }}
        </div>
        <v-table v-else density="compact" class="te-table">
          <thead>
            <tr>
              <th class="text-left">{{ $t('plugin_tasmota_energy.device') }}</th>
              <th class="text-right">{{ $t('plugin_tasmota_energy.power') }} (W)</th>
              <th class="text-right">{{ $t('plugin_tasmota_energy.today') }} (kWh)</th>
              <th class="text-right">{{ $t('plugin_tasmota_energy.yesterday') }} (kWh)</th>
              <th class="text-right">{{ $t('plugin_tasmota_energy.total') }} (kWh)</th>
              <th class="text-right">{{ $t('plugin_tasmota_energy.voltage') }} (V)</th>
              <th class="text-right">{{ $t('plugin_tasmota_energy.current') }} (A)</th>
              <th class="text-right">{{ $t('plugin_tasmota_energy.apparent_power') }} (VA)</th>
              <th class="text-right">{{ $t('plugin_tasmota_energy.reactive_power') }} (VAr)</th>
              <th class="text-right">{{ $t('plugin_tasmota_energy.factor') }} (%)</th>
              <th v-if="hasPrice" class="text-right">{{ $t('plugin_tasmota_energy.cost_today') }}</th>
              <th v-if="hasPrice" class="text-right">{{ $t('plugin_tasmota_energy.cost_total') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in results" :key="d.ip + d.name">
              <td>
                <div class="d-flex align-center" style="gap: 6px">
                  <v-icon v-if="!d.ok" size="16" color="error" :title="d.error">{{ d.ok ? '' : 'mdi-alert-circle-outline' }}</v-icon>
                  <span>{{ d.name }}</span>
                </div>
                <div v-if="!d.ok" class="text-caption text-error">{{ d.error }}</div>
              </td>
              <template v-if="d.ok">
                <td class="text-right">{{ fmt(d.power, 1) }}</td>
                <td class="text-right">{{ fmt(d.today, 3) }}</td>
                <td class="text-right">{{ fmt(d.yesterday, 3) }}</td>
                <td class="text-right">{{ fmt(d.total, 3) }}</td>
                <td class="text-right">{{ fmt(d.voltage, 1) }}</td>
                <td class="text-right">{{ fmt(d.current, 3) }}</td>
                <td class="text-right">{{ fmt(d.apparent_power, 1) }}</td>
                <td class="text-right">{{ fmt(d.reactive_power, 1) }}</td>
                <td class="text-right">{{ fmt(num(d.factor) === null ? null : num(d.factor) * 100, 0) }}</td>
                <td v-if="hasPrice" class="text-right">{{ costFmt(cost(savedSettings, d.today)) }}</td>
                <td v-if="hasPrice" class="text-right">{{ costFmt(cost(savedSettings, d.total)) }}</td>
              </template>
              <td v-else :colspan="hasPrice ? 10 : 8" class="text-right text-medium-emphasis">-</td>
            </tr>
            <tr v-if="results.some((d) => d.ok)" class="font-weight-medium">
              <td>{{ $t('plugin_tasmota_energy.totals') }}</td>
              <td class="text-right">{{ fmt(totals?.power, 1) }}</td>
              <td class="text-right">{{ fmt(totals?.today, 3) }}</td>
              <td class="text-right">{{ fmt(totals?.yesterday, 3) }}</td>
              <td class="text-right">{{ fmt(totals?.total, 3) }}</td>
              <td class="text-right">-</td>
              <td class="text-right">-</td>
              <td class="text-right">{{ fmt(totals?.apparent_power, 1) }}</td>
              <td class="text-right">{{ fmt(totals?.reactive_power, 1) }}</td>
              <td class="text-right">-</td>
              <td v-if="hasPrice" class="text-right">{{ costFmt(cost(savedSettings, totals?.today)) }}</td>
              <td v-if="hasPrice" class="text-right">{{ costFmt(cost(savedSettings, totals?.total)) }}</td>
            </tr>
          </tbody>
        </v-table>
        <div v-if="lastUpdate" class="text-caption text-medium-emphasis mt-2">
          {{ $t('plugin_tasmota_energy.updated') }}: {{ lastUpdate.toLocaleTimeString() }}
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { useTasmota, usePolling, loadSettings, saveSettings, queryDevices, DEFAULT_SETTINGS, fmt, cost, num } from './useTasmota.js';

// The host MOS app provides i18n globally; use its translator (same instance
// the template's $t resolves to) rather than bundling vue-i18n into the remote.
const $t = getCurrentInstance().appContext.config.globalProperties.$t;

const { loading, error, results, totals, lastUpdate, refresh } = useTasmota();
const form = ref({ ...DEFAULT_SETTINGS, devices: [] });
const savedSettings = ref({ ...DEFAULT_SETTINGS });
const saving = ref(false);
const saved = ref(false);
const saveFailed = ref(false);
const testState = reactive({}); // device index -> 'testing' | 'ok' | 'error'
const testMsg = ref({});
const poll = usePolling(refresh, 5);

const hasPrice = computed(() => num(savedSettings.value.price) > 0);
const costFmt = (v) => (v === null ? '-' : v.toFixed(2) + ' ' + savedSettings.value.currency);

// No real-world electricity price reaches 1 per kWh, so anything >= 1 is
// almost certainly entered in cents (e.g. 33.44 instead of 0.33).
const priceError = computed(() => num(form.value.price) >= 1);

const testDevice = async (i) => {
  const d = form.value.devices[i];
  if (!d?.ip) return;
  testState[i] = 'testing';
  testMsg.value[i] = '';
  try {
    const out = await queryDevices([d.ip, d.user || '', d.password || '']);
    const res = out.devices?.[0];
    if (res?.ok) {
      testState[i] = 'ok';
      testMsg.value[i] = `${d.ip}: ${fmt(res.power, 1)} W, ${$t('plugin_tasmota_energy.today')} ${fmt(res.today, 3)} kWh`;
    } else {
      testState[i] = 'error';
      testMsg.value[i] = res?.error || $t('plugin_tasmota_energy.test_failed');
    }
  } catch (e) {
    testState[i] = 'error';
    testMsg.value[i] = e.status === 403 ? $t('plugin_tasmota_energy.forbidden') : $t('plugin_tasmota_energy.test_failed');
  }
};

const save = async () => {
  saving.value = true;
  saved.value = false;
  saveFailed.value = false;
  if (priceError.value) {
    saving.value = false;
    saveFailed.value = true;
    return;
  }
  const s = {
    interval: Math.max(2, Number(form.value.interval) || DEFAULT_SETTINGS.interval),
    price: Number(form.value.price) || 0,
    currency: String(form.value.currency || '').trim() || 'EUR',
    devices: form.value.devices.map((d) => ({
      name: String(d.name || '').trim(),
      ip: String(d.ip || '').trim(),
      user: String(d.user || ''),
      password: String(d.password || ''),
    })).filter((d) => d.ip),
  };
  const ok = await saveSettings(s);
  form.value = { ...s, devices: s.devices.map((d) => ({ ...d })) };
  savedSettings.value = { ...s };
  saving.value = false;
  saved.value = ok;
  saveFailed.value = !ok;
  if (ok) await refresh();
};

onMounted(async () => {
  form.value = await loadSettings();
  savedSettings.value = { ...form.value, devices: form.value.devices.map((d) => ({ ...d })) };
  await refresh();
  poll.start(form.value.interval);
});

onUnmounted(() => poll.stop());
</script>

<style scoped>
.te-table {
  overflow-x: auto;
}
.te-table th {
  white-space: nowrap;
}
</style>
