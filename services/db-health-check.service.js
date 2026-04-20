const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const checkWithPgIsReady = async () => {
    const host = process.env.DB_HOST || '127.0.0.1';
    const port = process.env.DB_PORT || '5432';
    const user = process.env.DB_USER || '';
    const database = process.env.DB_NAME || '';

    await execFileAsync('pg_isready', ['-h', host, '-p', String(port), '-U', user, '-d', database]);
};

const waitForDatabaseReady = async (sequelize, options = {}) => {
    const maxAttempts = options.maxAttempts || 20;
    const delayMs = options.delayMs || 3000;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            try {
                await checkWithPgIsReady();
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }

            await sequelize.authenticate();
            return true;
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await sleep(delayMs);
            }
        }
    }

    throw lastError || new Error('Database health check failed.');
};

module.exports = {
    waitForDatabaseReady,
};
