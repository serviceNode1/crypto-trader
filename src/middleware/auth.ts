import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../services/auth/authService';
import { JWTPayload } from '../types/auth';
import { logger } from '../utils/logger';

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
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

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
