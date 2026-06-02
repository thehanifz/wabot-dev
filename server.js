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
const crypto = require('crypto');
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

// === H-04 FIX: Socket.IO dengan CORS restriction ke APP_URL saja ===
const allowedOrigin = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const io = new Server(server, {
    cors: {
        origin: allowedOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    // Batasi payload per event untuk mencegah abuse
    maxHttpBufferSize: 1e5, // 100 KB max per message
});

// === 1. MIDDLEWARE DASAR ===
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// CSP FIX: Hilangkan unsafe-inline dengan menggunakan nonce untuk style inline
// Nonce di-generate per-request dan di-inject ke res.locals
app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
});

app.use((req, res, next) => {
    helmet.contentSecurityPolicy({
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
            // CSP MEDIUM FIX: Ganti 'unsafe-inline' dengan nonce
            "style-src": ["'self'", `'nonce-${res.locals.cspNonce}'`, "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            "img-src": ["'self'", "data:", "https://*"],
            "connect-src": ["'self'", "ws:", "wss:"],
            "font-src": ["'self'", "https://cdnjs.cloudflare.com"]
        },
    })(req, res, next);
});

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

// Bagikan sesi Express ke Socket.IO agar socket bisa membaca session.passport.user
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// H-04 FIX: Wajib authenticated untuk bisa terkoneksi ke Socket.IO
io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.passport && session.passport.user) {
        return next();
    }
    return next(new Error('Unauthorized: Sesi tidak valid.'));
});

// H-04 FIX: Rate limiting per socket — max 60 events/menit
io.use((socket, next) => {
    let eventCount = 0;
    const WINDOW_MS = 60 * 1000;
    const MAX_EVENTS = 60;

    setInterval(() => { eventCount = 0; }, WINDOW_MS);

    const originalOnEvent = socket.onevent.bind(socket);
    socket.onevent = function (packet) {
        eventCount++;
        if (eventCount > MAX_EVENTS) {
            logger.warn(`[Socket.IO] Rate limit terlampaui untuk socket ${socket.id}`);
            socket.emit('error', { message: 'Rate limit exceeded. Coba lagi nanti.' });
            return;
        }
        originalOnEvent(packet);
    };
    next();
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
        if (process.env.NODE_ENV === 'production') {
            return res.status(500).json({ error: 'An internal server error occurred.' });
        }
        return res.status(500).json({
            error: err.message || 'Internal server error.',
            stack: err.stack || String(err),
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
        logger.info(`🔒 Socket.IO CORS dibatasi ke origin: ${allowedOrigin}`);

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
