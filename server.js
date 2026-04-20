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
const io = new Server(server);

// === 1. MIDDLEWARE DASAR ===
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(helmet.contentSecurityPolicy({
    directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        "img-src": ["'self'", "data:", "https://*"],
        "connect-src": ["'self'", "ws:", "wss:"],
        "font-src": ["'self'", "https://cdnjs.cloudflare.com"]
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

// Bagikan sesi Express ke Socket.IO agar socket bisa membaca session.passport.user
io.use((socket, next) => {
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
app.use('/dashboard', ensureAuthenticated, ensureTermsAccepted, dashboardRoutes);
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
    if (err.code !== 'EBADCSRFTOKEN') {
        console.error('🔥 CRITICAL ERROR:', err.stack || err);
        logger.error('Terjadi error tak terduga:', err);
    }

    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).send('<h1>403 - Forbidden</h1><p>Form expired. Silakan refresh halaman dan coba lagi.</p>');
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
            const fullPath = path.join(__dirname, 'public', dirPath);
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
                } catch (e) {}
            });
        } catch (e) {}
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
