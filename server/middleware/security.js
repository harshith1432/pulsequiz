const helmet = require('helmet');
const cors = require('cors');

// Simple in-memory sliding-window rate limiter for PIN verification
const pinAttempts = new Map(); // ip -> { count, firstAttempt }

function pinRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxAttempts = 10;

  let record = pinAttempts.get(ip);
  if (!record || now - record.firstAttempt > windowMs) {
    record = { count: 1, firstAttempt: now };
    pinAttempts.set(ip, record);
    return next();
  }

  record.count++;
  if (record.count > maxAttempts) {
    return res.status(429).json({
      error: 'Too many PIN verification attempts. Please wait a minute and try again.'
    });
  }

  next();
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of pinAttempts.entries()) {
    if (now - record.firstAttempt > 60 * 1000) {
      pinAttempts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

const securityMiddleware = [
  helmet({
    contentSecurityPolicy: false, // Disabled for easy local dev with WebSockets & inline QR SVG
    crossOriginEmbedderPolicy: false
  }),
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Host-Token']
  })
];

module.exports = {
  securityMiddleware,
  pinRateLimiter
};
