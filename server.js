require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const helmet = require('helmet');
const csurf = require('csurf');
const cookieParser = require('cookie-parser');
const { Server } = require("socket.io");

const sequelize = require('./config/database');
const logger = require('./config/logger');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

const { initSocket } = require('./services/socket.service');
const BaileysService = require('./services/baileys.service');
const { startQueueWorker } = require('./services/queue.service');
const { apiLimiter } = require('./middleware/rateLimiter.middleware');
const { initSettings } = require('./services/setting.service');
const { waitForDatabaseReady } = require('./services/db-health-check.service');

const app = express();
const server = http.createServer(app);

// H-04 FIX: Batasi Socket.IO hanya dari origin yang sama dengan BASE_URL
const allowedOrigins = process.env.BASE_URL
    ? [process.env.BASE_URL.trim().replace(/\/$/, '')]
    : [];

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.length === 0) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            logger.warn(`[Socket.IO] Origin ditolak: ${origin}`);
            return callback(new Error('Socket.IO origin tidak diizinkan'));
        },
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// === 1. MIDDLEWARE DASAR ===
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(helmet.contentSecurityPolicy({
    directives: {
        'default-src': ["'self'"],

        // Script: self + CDN yang dipakai UI
        'script-src': [
            "'self'",
            "'unsafe-inline'",          // Diperlukan oleh Tailwind CDN (inline config)
            "https://cdn.tailwindcss.com",
            "https://cdn.jsdelivr.net", // Alpine.js
            "https://unpkg.com",        // Lucide Icons
            "https://cdnjs.cloudflare.com",
        ],

        // Style: self + CDN yang dipakai UI
        'style-src': [
            "'self'",
            "'unsafe-inline'",          // Diperlukan oleh Tailwind CDN (inject style tag)
            "https://cdn.jsdelivr.net", // DaisyUI
            "https://fonts.googleapis.com",
            "https://cdnjs.cloudflare.com",
        ],

        // Font: self + Google Fonts
        'font-src': [
            "'self'",
            "https://fonts.gstatic.com",
            "https://cdnjs.cloudflare.com",
        ],

        // Gambar: self + data URI (untuk SVG inline di hero)
        'img-src': ["'self'", "data:", "https://*"],

        // WebSocket untuk Socket.IO
        'connect-src': ["'self'", "ws:", "wss:"],
    },
}));

// === 2. SESI DATABASE ===
const sessionStore = new SequelizeStore({ db: sequelize });
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    },
});

app.use(sessionMiddleware);

// H-04 FIX: Rate limit per-IP pada Socket.IO handshake
const socketConnectionAttempts = new Map();
const SOCKET_WINDOW_MS = 60 * 1000;
const SOCKET_MAX_ATTEMPTS = 30;

io.use((socket, next) => {
    const forwardedFor = socket.handshake.headers['x-forwarded-for'];
    const ipAddress = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || socket.handshake.address || 'unknown')
        .toString()
        .split(',')
        [0]
        .trim();

    const currentTime = Date.now();
    const attempts = socketConnectionAttempts.get(ipAddress) || [];
    const freshAttempts = attempts.filter(timestamp => currentTime - timestamp < SOCKET_WINDOW_MS);

    if (freshAttempts.length >= SOCKET_MAX_ATTEMPTS) {
        logger.warn(`[Socket.IO] Rate limit tercapai untuk IP: ${ipAddress}`);
        return next(new Error('Terlalu banyak koneksi socket. Coba lagi nanti.'));
    }

    freshAttempts.push(currentTime);
    socketConnectionAttempts.set(ipAddress, freshAttempts);

    sessionMiddleware(socket.request, {}, next);
});

// Inisialisasi Socket.io & Passport
initSocket(io);
require('./config/passport')(passport);

app.use(passport.initialize());
app.use(passport.session());

// === 3. VIEW ENGINE & FLASH ===
app.use(flash());
app.set('view engine', 'ejs');

// === 4. ROUTE API (Tanpa CSRF, pakai Rate Limiter) ===
const apiRoutes = require('./routes/api.routes');
app.use('/api', apiLimiter, apiRoutes);

// === 5. PROTEKSI CSRF (Untuk Form HTML) ===
const csrfProtection = csurf();
app.use(csrfProtection);

// Variabel Global untuk View (EJS)
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null;
    res.locals.adminContactInfo = process.env.ADMIN_CONTACT_INFO;
    next();
});

// === 6. ROUTE APLIKASI UTAMA ===
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const { ensureAuthenticated, ensureTermsAccepted } = require('./middleware/auth.middleware');

app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/users', ensureAuthenticated, ensureTermsAccepted, userRoutes);
app.use('/admin', ensureAuthenticated, ensureTermsAccepted, adminRoutes);

// Halaman Depan (Landing Page)
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.render('landing-page', { user: req.user });
});

// === 7. ERROR HANDLING ===
app.use((err, req, res, next) => {
    const expectsJson =
        req.xhr ||
        req.path.startsWith('/api/') ||
        req.headers.accept?.includes('application/json');

    if (err.code !== 'EBADCSRFTOKEN') {
        logger.error('Unhandled error:', err);
    }

    if (err.code === 'EBADCSRFTOKEN') {
        if (expectsJson) {
            return res.status(403).json({ error: 'CSRF token invalid. Refresh and retry.' });
        }
        return res.status(403).send('<h1>403 - Forbidden</h1><p>Form expired. Silakan refresh halaman dan coba lagi.</p>');
    }

    if (expectsJson) {
        return res.status(500).json({
            error: 'An internal server error occurred.',
        });
    }

    res.status(500).send(`
        <h1>500 - Server Error</h1>
        <p>Terjadi kesalahan sistem.</p>
        <pre>${process.env.NODE_ENV === 'development' ? (err.stack || err) : ''}</pre>
    `);
});

// Handle Promise Rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

// === 8. CLEANUP FILE SAMPAH ===
const cleanupOldFiles = () => {
    const fs = require('fs');

    const cleanupDir = (dirPath, maxAgeHours = 24) => {
        try {
            const fullPath = path.join(__dirname, dirPath);
            if (!fs.existsSync(fullPath)) return;

            const files = fs.readdirSync(fullPath);
            files.forEach(file => {
                try {
                    const filePath = path.join(fullPath, file);
                    const stats = fs.statSync(filePath);
                    if (stats.isFile() && (Date.now() - stats.mtimeMs > maxAgeHours * 3600000)) {
                        fs.unlinkSync(filePath);
                        logger.info(`File lama dihapus: ${filePath}`);
                    }
                } catch (e) { }
            });
        } catch (e) { }
    };

    cleanupDir('temp', 1);
    cleanupDir('uploads', 24);
};

// === 9. START SERVER & DATABASE ===
const PORT = process.env.PORT || 3000;

waitForDatabaseReady(sequelize).then(() => sequelize.sync({ alter: true })).then(async () => {

    logger.info('✅ Database Synced (alter: true)');

    sessionStore.sync();

    try {
        await initSettings();
    } catch (err) {
        logger.error('Gagal memuat settings awal:', err);
    }

    cleanupOldFiles();

    server.listen(PORT, async () => {
        logger.info(`🚀 Server berjalan di http://localhost:${PORT}`);

        try {
            logger.info('🔄 Menginisialisasi layanan Baileys...');
            await BaileysService.init();
        } catch (initError) {
            logger.error('❌ Gagal inisialisasi Baileys:', initError);
        }

        startQueueWorker();
    });

}).catch(err => {
    logger.error('❌ Gagal sinkronisasi database:', err);
});
