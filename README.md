# Tasmota Energy Monitor (MOS plugin)

A [MOS](https://mos-official.net/) plugin that shows the energy consumption of your
Tasmota power-monitoring devices (smart plugs, switches, meters) on the MOS dashboard —
similar to [Flippo24/tasmotapm-unraid](https://github.com/Flippo24/tasmotapm-unraid) for Unraid.

- **Dashboard widget**: total power draw plus per-device power, today's and total energy
- **Plugin page** (Plugins -> Tasmota Energy Monitor): full live table with power, today /
  yesterday / total energy, voltage, current, apparent and reactive power, power factor,
  and electricity cost (price x kWh) for every device
- **Multiple devices** with individual, optional Tasmota web credentials
- **Configurable refresh interval, electricity price and currency** (EUR/USD/...)
- Everything stays on your LAN — the MOS host polls the devices, nothing is sent anywhere else

## How it works

Stock Tasmota firmware does not send CORS headers, so the browser cannot query the device
directly from the MOS web UI. The plugin therefore ships a small server-side script,
`tasmota-energy-query` (bash + curl + jq), which MOS installs to `/usr/bin/plugins/`.
The frontend runs it every refresh interval through the MOS plugin query API
(`POST /api/v1/mos/plugins/query`) and renders the returned data.

Per device the script polls Tasmota's HTTP API:

```
http://<device-ip>/cm?cmnd=Status%208        # -> StatusSNS.ENERGY
```

Optional Tasmota web credentials are passed as `user=...&password=...` and are stored in
the plugin settings on the MOS boot drive (`/boot/optional/plugins/tasmota-energy/settings.json`).
The settings API requires an admin account.

## Install

1. Create a GitHub release (see [Releasing](#releasing)) or grab a prebuilt `.deb` from
   this repository's releases.
2. In MOS: **Plugins -> Install plugin** from this repository, or install the `.deb`
   manually with `dpkg -i`.
3. **Plugins -> Tasmota Energy Monitor**: add your devices (name, IP, optional
   username/password), set refresh interval, electricity price and currency, then **Save**.
   Use the per-device **Test** button to verify connectivity before saving.
4. Add the widget: **Dashboard -> edit -> add card -> Tasmota Energy**.

## Device setup notes

- The Tasmota device must run a firmware with energy monitoring enabled
  (e.g. a Sonoff POW, or a plug flashed with an energy-monitoring template).
- Protect a device that powers your server against accidental switch-offs, e.g. with
  Tasmota's `PowerOnState 4` (always on) — see the Tasmota documentation.
- If your device has web credentials configured, enter the same username/password
  used for its web UI.

## Local development

```bash
cd page
npm install
npm run build     # builds dist/tasmota-energy/ (remoteEntry.js + manifest.json)
```

Test the poll script standalone against a device:

```bash
./bin/tasmota-energy-query 192.168.x.x
# or against a settings file like on the MOS host:
TASMOTA_ENERGY_SETTINGS=./settings.json ./bin/tasmota-energy-query
```

## Releasing

The GitHub Actions workflow builds the Vue plugin and packages it as
`tasmota-energy-<version>-1+mos-plugin_all.deb` when a tag is pushed:

```bash
git tag 0.1.0 && git push origin 0.1.0
```

Repository settings -> Actions -> General -> Workflow permissions must allow
**Read and write permissions**.

The `.deb` carries both the built frontend (`/var/www/mos-plugins/tasmota-energy/`,
served at `/_plugins/tasmota-energy/`) and the poll script (`/usr/bin/plugins/`).

## Credits

- Idea and feature set from [Flippo24/tasmotapm-unraid](https://github.com/Flippo24/tasmotapm-unraid)
- Plugin structure based on [sampsi/mos-docker-widget](https://github.com/sampsi/mos-docker-widget)
  and [AzAel76/mos-docker-template-maker](https://github.com/AzAel76/mos-docker-template-maker)
