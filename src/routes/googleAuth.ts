import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import {
  verifyGoogleToken,
  loginWithGoogle,
  unlinkGoogleAccount,
} from '../services/auth/googleOAuthService';
import { logger } from '../utils/logger';
import { setAuthCookies } from '../services/auth/cookieAuthService';
import { authRateLimit } from '../middleware/security';

const router = Router();

/**
 * POST /api/auth/google
 * Login or register with Google OAuth
 * 
 * Body: { credential: string } - Google ID token from Google Sign-In
 */
router.post('/google', authRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({
        success: false,
        error: 'Missing credential',
        message: 'Google ID token is required',
      });
      return;
    }

    // Verify Google token
    const googleData = await verifyGoogleToken(credential);

    if (!googleData) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Failed to verify Google token',
      });
      return;
    }

    // Login or register user
    const result = await loginWithGoogle(googleData, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    logger.info('User authenticated via Google', { email: googleData.email });

    // Set httpOnly cookies (secure)
    setAuthCookies(res, result.token, result.refreshToken);

    res.json({
      success: true,
      message: 'Google authentication successful',
      data: result,
    });
  } catch (error: any) {
    logger.error('Google authentication failed', { error });

    const statusCode = error.message?.includes('deactivated') ? 403 : 500;

    res.status(statusCode).json({
      success: false,
      error: 'Authentication failed',
      message: error.message || 'An error occurred during Google authentication',
    });
  }
});

/**
 * POST /api/auth/google/unlink
 * Unlink Google account from user
 * (Requires authentication)
 */
router.post(
  '/google/unlink',
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

      await unlinkGoogleAccount(req.user.userId);

      res.json({
        success: true,
        message: 'Google account unlinked successfully',
      });
    } catch (error: any) {
      logger.error('Failed to unlink Google account', { error });

      const statusCode = error.message?.includes('Cannot unlink') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        error: 'Unlink failed',
        message: error.message || 'An error occurred while unlinking Google account',
      });
    }
  }
);

export default router;
