const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');
const logger = require('../config/logger');

module.exports = function (passport) {
    // === MODIFIKASI: Hanya aktifkan Google Auth jika Client ID tersedia ===
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID.length > 5) {
        
        logger.info('✅ Google Auth Enabled');
        
        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
            const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim());
            const userEmail = profile.emails[0].value;

            try {
                let user = await User.findOne({ where: { googleId: profile.id } });

                if (user) {
                    return done(null, user);
                } else {
                    const isAdmin = adminEmails.includes(userEmail);
                    
                    user = await User.create({
                        googleId: profile.id,
                        email: userEmail,
                        role: isAdmin ? 'admin' : 'user',
                        sessionLimit: isAdmin ? 999 : 1, 
                    });

                    return done(null, user);
                }
            } catch (err) {
                logger.error('Error saat autentikasi Google:', err);
                return done(err, false);
            }
        }));

    } else {
        logger.warn('⚠️ Google Auth Disabled (Missing Client ID in .env)');
    }
    // ===================================================================

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findByPk(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
};