module.exports = {
  apps: [
    {
      name: 'luminalog-api',
      script: 'dist/index.js',
      cwd: '/root/luminalog/luminalog-api',
      instances: 1,
      exec_mode: 'fork',
      kill_timeout: 5000,
      env: {
        PORT: '3200',
        NODE_ENV: 'production',
      },
    },
  ],
}
