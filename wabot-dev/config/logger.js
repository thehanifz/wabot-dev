const pino = require('pino');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

// Tentukan target logging berdasarkan environment
let transport;
if (isProduction) {
    // Di produksi, log ke file untuk persistensi
    transport = pino.transport({
        targets: [
            {
                level: 'info',
                target: 'pino/file',
                options: { destination: path.join(__dirname, '..', 'app.log') }
            },
            {
                level: 'error',
                target: 'pino/file',
                options: { destination: path.join(__dirname, '..', 'error.log') }
            }
        ]
    });
} else {
    // Di development, log ke console dengan format yang rapi
    transport = pino.transport({
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
            ignore: 'pid,hostname'
        }
    });
}

// Perbaikan: Set level log secara eksplisit. 'debug' untuk development, 'info' untuk produksi.
const logger = pino({
    level: isProduction ? 'info' : 'debug',
}, transport);

module.exports = logger;

