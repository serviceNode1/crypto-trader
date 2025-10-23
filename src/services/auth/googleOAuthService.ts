import { OAuth2Client } from 'google-auth-library';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { GoogleAuthData, AuthResponse } from '../../types/auth';
import { initializeUserPortfolio } from '../trading/paperTrading';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verify Google ID token
 */
export async function verifyGoogleToken(token: string): Promise<GoogleAuthData | null> {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return null;
    }

    return {
      googleId: payload.sub,
      email: payload.email || '',
      displayName: payload.name,
      profilePictureUrl: payload.picture,
      emailVerified: payload.email_verified || false,
    };
  } catch (error) {
    logger.error('Failed to verify Google token', { error });
    return null;
  }
}

/**
 * Login or register user with Google OAuth
 */
export async function loginWithGoogle(
  googleData: GoogleAuthData,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<AuthResponse> {
  try {
    // Check if user exists by Google ID
    let userResult = await query(
      `SELECT id, email, display_name, google_id, profile_picture_url,
              email_verified, is_active, is_admin, created_at, updated_at
       FROM users WHERE google_id = $1`,
      [googleData.googleId]
    );

    let user;

    if (userResult.rows.length === 0) {
      // Check if user exists by email (for account linking)
      userResult = await query(
        `SELECT id, email, display_name, google_id, profile_picture_url,
                email_verified, is_active, is_admin, created_at, updated_at
         FROM users WHERE email = $1`,
        [googleData.email.toLowerCase()]
      );

      if (userResult.rows.length > 0) {
        // Link Google account to existing user
        user = userResult.rows[0];
        
        await query(
          `UPDATE users 
           SET google_id = $1, 
               profile_picture_url = $2,
               email_verified = CASE WHEN email_verified = false THEN $3 ELSE email_verified END,
               last_login = NOW()
           WHERE id = $4`,
          [googleData.googleId, googleData.profilePictureUrl, googleData.emailVerified, user.id]
        );

        logger.info('Linked Google account to existing user', {
          userId: user.id,
          email: googleData.email,
        });
      } else {
        // Create new user
        const newUserResult = await query(
          `INSERT INTO users (
            email, google_id, display_name, profile_picture_url,
            email_verified, is_active, password_hash
          ) VALUES ($1, $2, $3, $4, $5, true, NULL)
          RETURNING id, email, display_name, google_id, profile_picture_url,
                    email_verified, is_active, is_admin, created_at, updated_at`,
          [
            googleData.email.toLowerCase(),
            googleData.googleId,
            googleData.displayName,
            googleData.profilePictureUrl,
            googleData.emailVerified,
          ]
        );

        user = newUserResult.rows[0];

        // Initialize portfolio for new user
        await initializeUserPortfolio(user.id);

        logger.info('Created new user via Google OAuth', {
          userId: user.id,
          email: googleData.email,
        });
      }
    } else {
      // User exists with this Google ID
      user = userResult.rows[0];

      // Update last login and profile picture
      await query(
        `UPDATE users 
         SET last_login = NOW(),
             profile_picture_url = $1,
             display_name = COALESCE(display_name, $2)
         WHERE id = $3`,
        [googleData.profilePictureUrl, googleData.displayName, user.id]
      );

      logger.info('User logged in via Google OAuth', {
        userId: user.id,
        email: googleData.email,
      });
    }

    // Check if account is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Create session using existing createSession function
    const { createSession } = await import('./authService');
    const sessionResult = await (createSession as any)(user.id, metadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        emailVerified: user.email_verified,
        isActive: user.is_active,
        isAdmin: user.is_admin,
        profilePictureUrl: user.profile_picture_url,
        googleId: user.google_id,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      token: sessionResult.token,
      refreshToken: sessionResult.refreshToken,
      expiresAt: sessionResult.expiresAt,
    };
  } catch (error) {
    logger.error('Google OAuth login failed', { error });
    throw error;
  }
}

/**
 * Unlink Google account from user
 */
export async function unlinkGoogleAccount(userId: number): Promise<void> {
  try {
    // Check if user has a password (can't unlink if it's the only auth method)
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    if (!result.rows[0].password_hash) {
      throw new Error('Cannot unlink Google account - no password set. Please set a password first.');
    }

    // Unlink Google account
    await query(
      `UPDATE users 
       SET google_id = NULL, 
           profile_picture_url = NULL
       WHERE id = $1`,
      [userId]
    );

    logger.info('Unlinked Google account', { userId });
  } catch (error) {
    logger.error('Failed to unlink Google account', { error, userId });
    throw error;
  }
}
