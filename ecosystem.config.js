module.exports = {
  apps : [{
    name   : "whatsapp-gateway",
    script : "./server.js",
    watch: false,
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 5,
    restart_delay: 10000,
    exp_backoff_restart_delay: 100,
    kill_timeout: 10000,
    listen_timeout: 10000,
    env_production: {
       NODE_ENV: "production"
    },
    env_development: {
       NODE_ENV: "development"
    }
  }]
}
