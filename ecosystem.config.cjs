module.exports = {
  apps: [
    {
      name: "bid-web",
      cwd: "/home/tw123457/bid_app",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "/home/tw123457/.nvm/versions/node/v24.19.0/bin/node",
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
