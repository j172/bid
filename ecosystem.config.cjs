// Paths are derived from the account's home directory rather than hard-coded
// to one cPanel account, so this file stays correct on both the current host
// and the sng105 migration target (issue #182) — see the matching comment in
// scripts/remote-apply.sh. Missing this file during the migration would be
// especially nasty: pm2 would only fail at the very end of an otherwise
// successful deploy, when it tries to start bid-web from a home directory
// that doesn't exist on the host it's running on.
//
// os.homedir() resolves to $HOME when set and falls back to the passwd entry
// for the running uid otherwise, so it holds under pm2's daemon as well as
// under a login shell.
const homeDir = require("os").homedir();
const nvmNodeDir = `${homeDir}/.nvm/versions/node/v24.19.0`;

module.exports = {
  apps: [
    {
      name: "bid-web",
      cwd: `${homeDir}/bid_app`,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: `${nvmNodeDir}/bin/node`,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      // Raised from 512M (issue #152) — pm2 logs showed bid-web hitting this
      // cap and crash-restarting repeatedly (WebAssembly OOM errors, one
      // native thread-creation crash), causing brief mass-502 windows on
      // every restart. Confirmed via SSH: the host has 54GB total RAM at
      // ~49% usage, bid-web's steady-state footprint is only ~150-170MB, and
      // sharp's native Linux x64 binary is installed correctly (not falling
      // back to a WASM codec) — the cap itself, not a leak or missing native
      // dependency, was the bottleneck. Next.js image optimization's memory
      // usage spikes transiently well above steady-state when resizing
      // several large source photos concurrently (e.g. multi-MB homepage
      // section uploads), which is what tripped it.
      max_memory_restart: "1536M",
      autorestart: true,
      watch: false,
    },
  ],
};
