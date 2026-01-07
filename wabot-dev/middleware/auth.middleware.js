function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Silakan login untuk melihat halaman ini.');
    res.redirect('/auth/login');
}

function ensureGuest(req, res, next) {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.redirect('/dashboard');
}

function hasRole(roles) {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).send('Tidak terautentikasi.');
        }
        if (roles.includes(req.user.role)) {
            return next();
        }
        res.status(403).send('Akses ditolak. Anda tidak memiliki izin yang cukup.');
    };
}

function ensureTermsAccepted(req, res, next) {
    if (req.user && req.user.hasAcceptedTerms) {
        return next();
    }
    
    const allowedPaths = ['/terms', '/logout'];
    if (allowedPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    res.redirect('/auth/terms');
}

module.exports = {
    ensureAuthenticated,
    ensureGuest,
    hasRole,
    ensureTermsAccepted,
};

