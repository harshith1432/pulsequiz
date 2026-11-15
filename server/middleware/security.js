const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');

// ---------------- RATE LIMITERS (express-rate-limit) ----------------

// Strict rate limiter for authentication endpoints (prevent brute-force password guessing)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

// Dedicated upload limiter for heavy file processing (Excel & PDF extraction)
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 file uploads per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Upload rate limit reached. Please wait a few minutes before uploading more documents.'
  }
});

// Room creation limiter to prevent room flood DoS attacks
const roomCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 rooms per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Room creation rate limit exceeded. Please wait a few moments before launching more rooms.'
  }
});

// General API limiter covering all /api/ endpoints to prevent scraping and API exhaustion
const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'API rate limit exceeded. Please throttle requests.'
  }
});

// PIN lookup limiter to prevent brute-forcing active 6-digit room PINs
const pinLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 PIN checks per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many room PIN lookup attempts. Please wait a moment before trying again.'
  }
});

// Maintain backward-compatible pinRateLimiter export
const pinRateLimiter = pinLimiter;

// ---------------- PROTOTYPE POLLUTION DEFENSE ----------------

function hasDangerousKeys(obj, visited = new WeakSet()) {
  if (!obj || typeof obj !== 'object') return false;
  if (visited.has(obj)) return false;
  visited.add(obj);

  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    const val = obj[key];
    if (val && typeof val === 'object' && hasDangerousKeys(val, visited)) {
      return true;
    }
  }
  return false;
}

function prototypePollutionGuard(req, res, next) {
  if (
    (req.body && hasDangerousKeys(req.body)) ||
    (req.query && hasDangerousKeys(req.query)) ||
    (req.params && hasDangerousKeys(req.params))
  ) {
    return res.status(400).json({ error: 'Malicious payload detected: parameter tampering / prototype pollution blocked.' });
  }
  next();
}

// ---------------- CORS POLICY CONFIGURATION ----------------

const allowedOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}|.*\.trycloudflare\.com)(:\d+)?$/i;

function corsOriginValidator(origin, callback) {
  // Allow requests without Origin (curl, mobile apps, same-origin, server-to-server)
  if (!origin) {
    return callback(null, true);
  }

  // Check explicit environment configuration
  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
    if (origins.includes('*') || origins.includes(origin)) {
      return callback(null, true);
    }
  }

  // Check dynamic LAN, Cloudflare tunnel, and localhost matching
  if (allowedOriginRegex.test(origin) || process.env.NODE_ENV !== 'production') {
    return callback(null, true);
  }

  return callback(new Error(`CORS blocked: Origin ${origin} not permitted.`));
}

// ---------------- SECURITY MIDDLEWARE CHAIN ----------------

const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:", "https:", "http:"],
        fontSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }),
  cors({
    origin: corsOriginValidator,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Host-Token', 'X-Auth-Token', 'X-Gemini-Key'],
    credentials: true
  })
];

module.exports = {
  securityMiddleware,
  prototypePollutionGuard,
  authLimiter,
  uploadLimiter,
  roomCreationLimiter,
  generalApiLimiter,
  pinLimiter,
  pinRateLimiter
};
