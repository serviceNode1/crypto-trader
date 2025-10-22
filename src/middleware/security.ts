import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per IP
 * More lenient in development for testing
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 500, // 500 in dev, 100 in prod
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Too many requests from this IP, please try again later.',
    });
  },
});

/**
 * Strict rate limiting for authentication endpoints
 * More lenient in development for testing
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // 100 in dev, 10 in prod
  message: {
    success: false,
    error: 'Too many login attempts',
    message: 'Too many login attempts. Please try again later.',
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      error: 'Too many login attempts',
      message: 'Too many login attempts. Please try again later.',
    });
  },
});

/**
 * Lenient rate limiting for settings endpoints
 * Settings are read frequently (on page load, settings modal open, etc.)
 */
export const settingsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 1000, // Very lenient in dev, reasonable in prod
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many settings requests. Please try again later.',
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Settings rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Too many settings requests. Please try again later.',
    });
  },
});

/**
 * Modern CSRF Protection using Double-Submit Cookie Pattern
 * 
 * How it works:
 * 1. Server generates random token and sends as cookie
 * 2. Client must send same token in X-CSRF-Token header
 * 3. Server verifies cookie matches header
 * 4. Attacker cannot read cookies due to same-origin policy
 */

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate and set CSRF token cookie
 */
export function generateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Skip if token already exists
  if (req.cookies?.[CSRF_COOKIE_NAME]) {
    next();
    return;
  }

  // Generate random token
  const token = crypto.randomBytes(32).toString('hex');

  // Set as cookie (NOT httpOnly - client needs to read it)
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Client must read this for double-submit pattern
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  next();
}

/**
 * Verify CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
 */
export function verifyCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;

  if (!cookieToken || !headerToken) {
    logger.warn('CSRF token missing', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
    });

    res.status(403).json({
      success: false,
      error: 'CSRF token missing',
      message: 'CSRF token is required for this operation',
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    logger.warn('CSRF token mismatch', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });

    res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
      message: 'CSRF token validation failed',
    });
    return;
  }

  next();
}

/**
 * Security Headers Middleware
 * Sets various security headers to protect against common attacks
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://accounts.google.com",
      "frame-src 'self' https://accounts.google.com",
    ].join('; ')
  );

  // Strict Transport Security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

/**
 * Log security-relevant events
 */
export function securityLogger(req: Request, res: Response, next: NextFunction): void {
  // Log authentication attempts
  if (req.path.includes('/auth/login') || req.path.includes('/auth/register')) {
    logger.info('Auth attempt', {
      ip: req.ip,
      path: req.path,
      userAgent: req.headers['user-agent'],
    });
  }

  // Log administrative actions
  if (req.user?.isAdmin && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    logger.info('Admin action', {
      userId: req.user.userId,
      email: req.user.email,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
  }

  next();
}

/**
 * Sanitize user input to prevent XSS
 * Basic sanitization - for production, use a library like DOMPurify or validator
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous HTML/script tags
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
}
