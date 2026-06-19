module.exports = {
  apps: [
    {
      name: 'luminalog-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/root/luminalog/luminalog-web',
      instances: 1,
      exec_mode: 'fork',
      kill_timeout: 5000,
      env: {
        PORT: '3100',
        NODE_ENV: 'production',
      },
    },
  ],
}
