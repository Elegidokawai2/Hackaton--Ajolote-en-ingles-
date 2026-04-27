const rateLimit = require('express-rate-limit');

const getEnv = (key, fallback) => {
    const value = process.env[key];
    return value ? Number(value) : fallback;
};

// LOGIN — allows 10 attempts per 15 mins
const loginLimiter = rateLimit({
    windowMs: getEnv('RATE_LIMIT_LOGIN_WINDOW_MS', 15 * 60 * 1000),
    max: getEnv('RATE_LIMIT_LOGIN_MAX', 10),
    message: {
        error: 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo en 15 minutos.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// REGISTER — allows 5 attempts per hour
const registerLimiter = rateLimit({
    windowMs: getEnv('RATE_LIMIT_REGISTER_WINDOW_MS', 60 * 60 * 1000),
    max: getEnv('RATE_LIMIT_REGISTER_MAX', 5),
    message: {
        error: 'Demasiadas cuentas creadas desde esta IP. Inténtalo de nuevo en una hora.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// GLOBAL API — 100 / minute
const apiLimiter = rateLimit({
    windowMs: getEnv('RATE_LIMIT_API_WINDOW_MS', 60 * 1000),
    max: getEnv('RATE_LIMIT_API_MAX', 100),
    message: {
        error: 'Demasiadas solicitudes. Inténtalo de nuevo en un momento.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    loginLimiter,
    registerLimiter,
    apiLimiter,
};