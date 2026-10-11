<template>
  <div>
    <div v-if="loading" class="d-flex justify-center pa-4">
      <v-progress-circular indeterminate size="24" width="2" />
    </div>
    <div v-else-if="error" class="text-center pa-3">
      <v-icon size="32" color="grey" class="mb-2">mdi-flash</v-icon>
      <div class="text-body-2 text-medium-emphasis">
        {{ error === 'forbidden' ? $t('plugin_tasmota_energy.forbidden') : $t('plugin_tasmota_energy.load_failed') }}
      </div>
    </div>
    <div v-else-if="settings.devices.length === 0" class="text-center pa-3">
      <v-icon size="32" color="grey" class="mb-2">mdi-flash</v-icon>
      <div class="text-body-2 text-medium-emphasis mb-2">{{ $t('plugin_tasmota_energy.no_devices') }}</div>
      <v-btn size="small" variant="tonal" :to="`/plugins/${PLUGIN}`">
        {{ $t('plugin_tasmota_energy.open_settings') }}
      </v-btn>
    </div>
    <div v-else>
      <div class="d-flex align-center mb-2" style="gap: 6px">
        <v-chip size="small" variant="tonal" color="primary">
          <v-icon start size="14">mdi-flash</v-icon>
          {{ fmt(totals?.power, 1) }} W
        </v-chip>
        <v-chip size="small" variant="tonal">
          {{ $t('plugin_tasmota_energy.today') }}: {{ fmt(totals?.today, 3) }} kWh
        </v-chip>
        <v-spacer />
        <v-btn
          size="x-small"
          variant="text"
          icon="mdi-cog"
          :to="`/plugins/${PLUGIN}`"
          :title="$t('plugin_tasmota_energy.open_settings')"
        />
      </div>

      <div v-for="d in results" :key="d.ip + d.name" class="te-row d-flex align-center">
        <v-icon v-if="d.ok" size="18" color="green" class="mr-1">mdi-power-plug</v-icon>
        <v-icon v-else size="18" color="error" class="mr-1" :title="d.error">mdi-power-plug-off</v-icon>
        <div class="te-text">
          <div class="text-body-2 te-name" :title="d.name">{{ d.name }}</div>
          <div class="text-caption text-medium-emphasis te-sub">
            <template v-if="d.ok">{{ $t('plugin_tasmota_energy.today') }} {{ fmt(d.today, 3) }} kWh · {{ $t('plugin_tasmota_energy.total') }} {{ fmt(d.total, 3) }} kWh</template>
            <template v-else>{{ d.error }}</template>
          </div>
        </div>
        <span class="text-body-2 font-weight-medium">{{ d.ok ? fmt(d.power, 1) + ' W' : '-' }}</span>
      </div>

      <div v-if="hasPrice" class="text-caption text-medium-emphasis mt-2">
        {{ $t('plugin_tasmota_energy.cost_today') }}: {{ costFmt(cost(settings, totals?.today)) }}
        · {{ $t('plugin_tasmota_energy.cost_total') }}: {{ costFmt(cost(settings, totals?.total)) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useTasmota, usePolling, loadSettings, DEFAULT_SETTINGS, fmt, cost, num, PLUGIN } from './useTasmota.js';

const { loading, error, results, totals, refresh } = useTasmota();
const settings = ref({ ...DEFAULT_SETTINGS, devices: [] });
const poll = usePolling(refresh, 5);

const hasPrice = computed(() => num(settings.value.price) > 0);
const costFmt = (v) => (v === null ? '-' : v.toFixed(2) + ' ' + settings.value.currency);

onMounted(async () => {
  settings.value = await loadSettings();
  await refresh();
  poll.start(settings.value.interval);
});

onUnmounted(() => poll.stop());
</script>

<style scoped>
.te-row {
  gap: 8px;
  padding: 3px 0;
  min-width: 0;
}
.te-row + .te-row {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.te-text {
  flex: 1;
  min-width: 0;
}
.te-name,
.te-sub {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25;
}
</style>
