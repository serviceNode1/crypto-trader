import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { JWTPayload } from '../types/auth';
import { logger } from '../utils/logger';
import { getAccessTokenFromCookie } from '../services/auth/cookieAuthService';
import { validateSession } from '../services/auth/authService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Authenticate request - requires valid JWT token
 * Checks httpOnly cookie first, then falls back to Authorization header
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Priority 1: Check httpOnly cookie (most secure)
    let token = getAccessTokenFromCookie(req);

    // Priority 2: Fall back to Authorization header (backwards compatibility)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'No token provided',
      });
      return;
    }

    // Validate session
    const payload = await validateSession(token);

    if (!payload) {
      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Attach user to request
    req.user = payload;

    next();
  } catch (error) {
    logger.error('Authentication error', { error });
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: 'Internal server error',
    });
  }
}

/**
 * Require admin privileges
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin privileges required',
    });
    return;
  }

  next();
}

/**
 * Optional authentication - attach user if token provided, but don't require it
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await validateSession(token);

      if (payload) {
        req.user = payload;
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    next();
  }
}
