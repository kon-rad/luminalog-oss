module.exports = {
  apps: [
    {
      name: 'luminalog-api',
      script: 'dist/index.js',
      cwd: '/root/luminalog/luminalog-api',
      instances: 1,
      exec_mode: 'fork',
      kill_timeout: 5000,
      // Load the server .env via Node (v20.6+) at process start. Shell-sourcing
      // (`set -a; . ./.env`) CANNOT parse the inline FIREBASE_SERVICE_ACCOUNT_JSON
      // (spaces break it → env loads empty → Zod boot check crash-loops → 502).
      // Node's --env-file parses it correctly. Deploy via `pm2 start ecosystem.config.js`
      // (NOT `pm2 restart --update-env`, which would overwrite the process env with the
      // unsourced shell env and crash-loop).
      node_args: '--env-file=.env',
      env: {
        PORT: '3200',
        NODE_ENV: 'production',
      },
    },
  ],
}
