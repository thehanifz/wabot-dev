module.exports = {
  apps : [{
    name   : "whatsapp-gateway",
    script : "./server.js",
    watch: false, // Nonaktifkan watch di produksi
    max_memory_restart: '1G', // Restart jika memori > 1GB
    min_uptime: '10s', // Minimal waktu proses berjalan sebelum dianggap sukses
    max_restarts: 5, // Maksimal restart dalam interval waktu restart_time
    restart_delay: 10000, // Delay antar restart (10 detik) - memberi waktu untuk database siap
    exp_backoff_restart_delay: 100, // Waktu delay eksponensial saat restart gagal
    env_production: {
       NODE_ENV: "production"
    },
    env_development: {
       NODE_ENV: "development"
    }
  }]
}
