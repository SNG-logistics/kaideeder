// =============================================================================
// KAIDEEDER.com — PM2 Ecosystem Config
// =============================================================================
// Usage:
//   pm2 start ecosystem.config.js --env production
//   pm2 save
//   pm2 startup  (auto-start on server reboot)
// =============================================================================

module.exports = {
    apps: [
        {
            name: 'kaideeder',
            script: 'node',
            args: '.next/standalone/server.js',
            cwd: '/home/u12345678/public_html/kaideeder', // ← เปลี่ยนเป็น path จริงบนเซิร์ฟเวอร์

            // ── Process Settings ──────────────────────────────────────────
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',

            // ── Logging ────────────────────────────────────────────────────
            out_file: './logs/pm2-out.log',
            error_file: './logs/pm2-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,

            // ── Production ─────────────────────────────────────────────────
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000,
                HOSTNAME: '127.0.0.1',
            },

            // ── Development (local test) ───────────────────────────────────
            env_development: {
                NODE_ENV: 'development',
                PORT: 3001,
                HOSTNAME: '127.0.0.1',
            },
        },
    ],
}
