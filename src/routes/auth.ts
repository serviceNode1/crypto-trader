import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getUserById,
} from '../services/auth/authService';
import {
  validate,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from '../validators/authValidators';
import { logger } from '../utils/logger';
import { setAuthCookies, clearAuthCookies, getRefreshTokenFromCookie } from '../services/auth/cookieAuthService';
import { authRateLimit } from '../middleware/security';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
  '/register',
  authRateLimit,
  validate(registerSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, displayName } = req.body;

      const result = await registerUser({
        email,
        password,
        displayName,
      });

      logger.info('User registered via API', { email });

      // Set httpOnly cookies (secure)
      setAuthCookies(res, result.token, result.refreshToken);

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: result,
      });
    } catch (error: any) {
      logger.error('Registration failed', { error });

      const statusCode = error.message.includes('already registered')
        ? 409
        : 400;

      res.status(statusCode).json({
        success: false,
        error: 'Registration failed',
        message: error.message || 'An error occurred during registration',
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post(
  '/login',
  authRateLimit,
  validate(loginSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      const result = await loginUser(
        { email, password },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      logger.info('User logged in via API', { email });

      // Set httpOnly cookies (secure)
      setAuthCookies(res, result.token, result.refreshToken);

      res.json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error: any) {
      logger.error('Login failed', { error });

      const statusCode = error.message.includes('locked') ? 423 : 401;

      res.status(statusCode).json({
        success: false,
        error: 'Login failed',
        message: error.message || 'Invalid credentials',
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user (invalidate session)
 */
router.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.headers.authorization?.substring(7) || '';

      await logoutUser(token);

      // Clear httpOnly cookies
      clearAuthCookies(res);

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      logger.error('Logout failed', { error });

      res.status(500).json({
        success: false,
        error: 'Logout failed',
        message: 'An error occurred during logout',
      });
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Try cookie first, then body
      const refreshToken = getRefreshTokenFromCookie(req) || req.body.refreshToken;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token required',
        });
        return;
      }

      const result = await refreshAccessToken(refreshToken);

      // Set new access token cookie
      if (result.token) {
        setAuthCookies(res, result.token, refreshToken);
      }

      res.json({
        success: true,
        message: 'Token refreshed',
        data: result,
      });
    } catch (error: any) {
      logger.error('Token refresh failed', { error });

      res.status(401).json({
        success: false,
        error: 'Token refresh failed',
        message: error.message || 'Invalid refresh token',
      });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      const user = await getUserById(req.user.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Remove sensitive fields
      const { failedLoginAttempts, lastFailedLogin, lockedUntil, ...safeUser } =
        user;

      res.json({
        success: true,
        data: safeUser,
      });
    } catch (error) {
      logger.error('Failed to get user profile', { error });

      res.status(500).json({
        success: false,
        error: 'Failed to get profile',
        message: 'An error occurred',
      });
    }
  }
);

/**
 * GET /api/auth/config
 * Get public auth configuration (Google Client ID, etc.)
 */
router.get('/config', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: {
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      hasGoogleAuth: !!process.env.GOOGLE_CLIENT_ID,
    },
  });
});

// Debug endpoint to check CSRF cookie
router.get('/debug/csrf', async (req: Request, res: Response): Promise<void> => {
  const csrfCookie = req.cookies?.['csrf_token'];
  const allCookies = Object.keys(req.cookies || {});
  
  res.json({
    success: true,
    data: {
      hasCsrfCookie: !!csrfCookie,
      csrfToken: csrfCookie ? csrfCookie.substring(0, 20) + '...' : null,
      allCookies: allCookies,
      cookieCount: allCookies.length,
    },
  });
});

/**
 * GET /api/auth/status
 * Check authentication status (no token required)
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.json({
      success: true,
      authenticated: false,
    });
    return;
  }

  try {
    const token = authHeader.substring(7);
    const { validateSession } = await import('../services/auth/authService');
    const payload = await validateSession(token);

    if (payload) {
      res.json({
        success: true,
        authenticated: true,
        user: {
          userId: payload.userId,
          email: payload.email,
          isAdmin: payload.isAdmin,
        },
      });
    } else {
      res.json({
        success: true,
        authenticated: false,
      });
    }
  } catch (error) {
    res.json({
      success: true,
      authenticated: false,
    });
  }
});

export default router;
