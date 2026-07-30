module.exports = {
  apps: [
    {
      name: "bid-web",
      cwd: "/home/tw123457/bid_app",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "/home/tw123457/.nvm/versions/node/v20.20.2/bin/node",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      max_memory_restart: "512M",
      autorestart: true,
      watch: false,
    },
  ],
};
