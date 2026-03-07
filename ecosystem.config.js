// KAIDEEDER.com — PM2 Ecosystem Config
// Usage: pm2 start ecosystem.config.js

module.exports = {
    apps: [
        {
            name: 'kaideeder',
            script: 'node',
            args: '.next/standalone/server.js',
            cwd: '/home/user/public_html/kaideeder',  // ← เปลี่ยนเป็น path จริงบน server
            instances: 1,
            exec_mode: 'fork',
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000,
                HOSTNAME: '0.0.0.0',
            },
            // Auto-restart on crash
            watch: false,
            max_memory_restart: '512M',
            // Logging
            out_file: './logs/out.log',
            error_file: './logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        }
    ]
}
