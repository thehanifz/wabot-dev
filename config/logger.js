const pino = require('pino');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const logDir = path.join(__dirname, '..');

let transport;
if (isProduction) {
    transport = pino.transport({
        targets: [
            {
                level: 'info',
                target: 'pino-roll',
                options: {
                    file: path.join(logDir, 'app.log'),
                    mkdir: true,
                    size: '100m',
                    frequency: 'daily',
                    limit: { count: 7 }
                }
            },
            {
                level: 'error',
                target: 'pino-roll',
                options: {
                    file: path.join(logDir, 'error.log'),
                    mkdir: true,
                    size: '100m',
                    frequency: 'daily',
                    limit: { count: 7 }
                }
            }
        ]
    });
} else {
    transport = pino.transport({
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
            ignore: 'pid,hostname'
        }
    });
}

const logger = pino({
    level: isProduction ? 'info' : 'debug',
}, transport);

module.exports = logger;
