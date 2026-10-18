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

The plugin is available through the MOS Hub via my template repository
[jon-rei/mos-templates](https://github.com/jon-rei/mos-templates):

1. In MOS: **Settings -> System Configuration -> MOS Hub Settings**, enable the Hub if
   it is not already.
2. Open **MOS Hub**, click the repositories icon, add
   `https://github.com/jon-rei/mos-templates` to the repository list and save — MOS
   clones and indexes the repository.
3. **MOS Hub -> Plugins -> Tasmota Energy Monitor -> Install**, pick the release shown
   (e.g. `v0.0.1`). MOS downloads the `.deb` from the release and installs it
   (frontend -> `/var/www/mos-plugins/tasmota-energy/`, poll script -> `/usr/bin/plugins/`).
4. Configure it: **Plugins -> Tasmota Energy Monitor** — add your devices (name, IP,
   optional username/password), set refresh interval, electricity price and currency,
   then **Save** (the per-device **Test** button verifies connectivity).
   The electricity price is per kWh **in your currency's main unit**, e.g. `0.33` for
   33 cents — entering it in cents (e.g. `33.44`) is rejected with an error message.
5. Add the widget: **Dashboard -> edit -> add the Tasmota Energy card**.

Requires an admin account in MOS, and the MOS host must be able to reach the Tasmota
device over HTTP (`curl http://<device-ip>/cm?cmnd=Status%208` should return JSON).

## Settings

All settings are configured on the plugin page (**Plugins -> Tasmota Energy Monitor**)

| Setting | Default | Description |
|---|---|---|
| `devices` | `[]` | Devices to poll. Each device has a `name` (label in widget and table; the IP is shown when empty), an `ip` (device address, required — entries without one are dropped on save), and optional `user` / `password` for Tasmota web credentials. The **Test** button on the settings page verifies one device before saving. |
| `interval` | `5` | Refresh interval in seconds, used for polling on both the plugin page and the widget. Values below 2 are clamped to 2. |
| `price` | `0` | Electricity price per kWh **in the currency's main unit**, e.g. `0.33` for 33 cents. Saving a value >= 1 is rejected with an error message — it is almost certainly a cents entry. `0` disables the cost display. |
| `currency` | `EUR` | Currency shown as suffix for costs (e.g. `EUR`, `USD`). Free text, no validation. |

## Device setup notes

- The Tasmota device must run a firmware with energy monitoring enabled
  (e.g. a Sonoff POW, or a plug flashed with an energy-monitoring template).
- Protect a device that powers your server against accidental switch-offs, e.g. with
  Tasmota's `PowerOnState 4` (always on) — see the Tasmota documentation.
- If your device has web credentials configured, enter the same username/password
  used for its web UI.
- Multi-channel devices (e.g. Shelly 2.5, or `SetOption129 1`) are shown as one
  row: power, current and energy are summed across channels, voltage and power
  factor are averaged.

## Local development

Build the frontend in a Node 22 container — no local Node/npm installation needed:

```bash
docker run --rm --userns=keep-id -e HOME=/tmp -v $PWD/page:/app -w /app node:22-alpine \
  sh -c "npm ci && npm run build"
```

This produces `page/dist/tasmota-energy/` (`remoteEntry.js`, `manifest.json`,
the federation chunks and `icon.png`, copied from `page/public/`; `icon` is left
empty in `plugin.config.js` so MOS uses that file). On a plain Docker daemon
(not rootless podman) use `-u $(id -u):$(id -g)` instead of `--userns=keep-id`.

Rootless podman fails with `newuidmap: Could not set caps` when run from a shell
that has the `no_new_privs` flag set (`grep NoNewPrivs /proc/self/status` shows
`1`), as some sandboxed terminals and tools do. Run the build from a regular
terminal instead.

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
git tag v0.0.1 && git push origin v0.0.1
```

The `.deb` carries both the built frontend (`/var/www/mos-plugins/tasmota-energy/`,
served at `/_plugins/tasmota-energy/`) and the poll script (`/usr/bin/plugins/`).

## Credits

- Idea and feature set from [Flippo24/tasmotapm-unraid](https://github.com/Flippo24/tasmotapm-unraid)
- Plugin structure based on [sampsi/mos-docker-widget](https://github.com/sampsi/mos-docker-widget)
  and [AzAel76/mos-docker-template-maker](https://github.com/AzAel76/mos-docker-template-maker)
