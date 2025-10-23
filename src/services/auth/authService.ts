import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { initializeUserPortfolio } from '../trading/paperTrading';
import {
  User,
  AuthCredentials,
  RegisterData,
  AuthResponse,
  JWTPayload,
} from '../../types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = '24h';
const REFRESH_TOKEN_EXPIRES_IN = '30d';
const BCRYPT_SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    logger.warn('Invalid token', { error });
    return null;
  }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Register new user
 */
export async function registerUser(data: RegisterData): Promise<AuthResponse> {
  const { email, password, displayName } = data;

  try {
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, display_name, email_verified, is_active)
       VALUES ($1, $2, $3, false, true)
       RETURNING id, email, display_name, email_verified, is_active, is_admin, created_at`,
      [email.toLowerCase(), passwordHash, displayName || null]
    );

    const user = userResult.rows[0];

    // Initialize portfolio for new user
    await initializeUserPortfolio(user.id);

    // Create session
    const sessionResult = await createSession(user.id, {
      ipAddress: undefined,
      userAgent: undefined,
    });

    logger.info('User registered successfully', { userId: user.id, email });

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
    logger.error('Registration failed', { error, email });
    throw error;
  }
}

/**
 * Login user
 */
export async function loginUser(
  credentials: AuthCredentials,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<AuthResponse> {
  const { email, password } = credentials;

  try {
    // Get user
    const userResult = await query(
      `SELECT id, email, password_hash, display_name, email_verified, is_active, is_admin,
              failed_login_attempts, locked_until, last_login, created_at, updated_at,
              profile_picture_url, google_id
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = userResult.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(user.locked_until).getTime() - Date.now()) / 60000
      );
      throw new Error(
        `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s)`
      );
    }

    // Check if account is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const passwordMatch = await comparePassword(password, user.password_hash);

    if (!passwordMatch) {
      // Increment failed login attempts
      await handleFailedLogin(user.id);
      throw new Error('Invalid email or password');
    }

    // Reset failed login attempts
    await query(
      `UPDATE users 
       SET failed_login_attempts = 0, 
           locked_until = NULL, 
           last_login = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Create session
    const sessionResult = await createSession(user.id, metadata);

    logger.info('User logged in successfully', { userId: user.id, email });

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
    logger.error('Login failed', { error, email });
    throw error;
  }
}

/**
 * Handle failed login attempt
 */
async function handleFailedLogin(userId: number): Promise<void> {
  const result = await query(
    `UPDATE users 
     SET failed_login_attempts = failed_login_attempts + 1,
         last_failed_login = NOW()
     WHERE id = $1
     RETURNING failed_login_attempts`,
    [userId]
  );

  const attempts = result.rows[0].failed_login_attempts;

  // Lock account if max attempts reached
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    await query(
      `UPDATE users 
       SET locked_until = NOW() + INTERVAL '${LOCK_DURATION_MINUTES} minutes'
       WHERE id = $1`,
      [userId]
    );

    logger.warn('Account locked due to failed login attempts', {
      userId,
      attempts,
    });
  }
}

/**
 * Create session
 */
export async function createSession(
  userId: number,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<{
  token: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const payload: JWTPayload = {
    userId,
    email: '', // Will be filled from database
    isAdmin: false, // Will be filled from database
    sessionId: 0, // Will be filled after session creation
  };

  // Get user details
  const userResult = await query(
    'SELECT email, is_admin FROM users WHERE id = $1',
    [userId]
  );
  const user = userResult.rows[0];
  payload.email = user.email;
  payload.isAdmin = user.is_admin;

  // Generate tokens (without sessionId for now)
  const token = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Calculate expiration times
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Store session in database
  const sessionResult = await query(
    `INSERT INTO sessions (user_id, token, refresh_token, expires_at, refresh_expires_at, ip_address, user_agent, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING id`,
    [
      userId,
      token,
      refreshToken,
      expiresAt,
      refreshExpiresAt,
      metadata?.ipAddress || null,
      metadata?.userAgent || null,
    ]
  );

  const sessionId = sessionResult.rows[0].id;

  // Regenerate tokens with sessionId
  payload.sessionId = sessionId;
  const finalToken = generateAccessToken(payload);
  const finalRefreshToken = generateRefreshToken(payload);

  // Update session with new tokens
  await query(
    'UPDATE sessions SET token = $1, refresh_token = $2 WHERE id = $3',
    [finalToken, finalRefreshToken, sessionId]
  );

  return {
    token: finalToken,
    refreshToken: finalRefreshToken,
    expiresAt,
  };
}

/**
 * Logout user (invalidate session)
 */
export async function logoutUser(token: string): Promise<void> {
  try {
    await query('UPDATE sessions SET is_active = false WHERE token = $1', [
      token,
    ]);
    logger.info('User logged out successfully');
  } catch (error) {
    logger.error('Logout failed', { error });
    throw error;
  }
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  try {
    // Verify refresh token
    const payload = verifyToken(refreshToken);
    if (!payload) {
      throw new Error('Invalid refresh token');
    }

    // Check if session is active
    const sessionResult = await query(
      'SELECT id, user_id, is_active FROM sessions WHERE refresh_token = $1',
      [refreshToken]
    );

    if (sessionResult.rows.length === 0 || !sessionResult.rows[0].is_active) {
      throw new Error('Session expired or invalid');
    }

    const session = sessionResult.rows[0];

    // Generate new access token
    const newToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      isAdmin: payload.isAdmin,
      sessionId: session.id,
    });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update session
    await query(
      'UPDATE sessions SET token = $1, expires_at = $2, last_activity = NOW() WHERE id = $3',
      [newToken, expiresAt, session.id]
    );

    logger.info('Access token refreshed', { userId: payload.userId });

    return {
      token: newToken,
      expiresAt,
    };
  } catch (error) {
    logger.error('Token refresh failed', { error });
    throw error;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number): Promise<User | null> {
  try {
    const result = await query(
      `SELECT id, email, display_name, google_id, profile_picture_url,
              email_verified, is_active, is_admin, failed_login_attempts,
              last_failed_login, locked_until, last_login, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      googleId: user.google_id,
      profilePictureUrl: user.profile_picture_url,
      emailVerified: user.email_verified,
      isActive: user.is_active,
      isAdmin: user.is_admin,
      failedLoginAttempts: user.failed_login_attempts,
      lastFailedLogin: user.last_failed_login,
      lockedUntil: user.locked_until,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  } catch (error) {
    logger.error('Failed to get user', { error, userId });
    return null;
  }
}

/**
 * Validate session
 */
export async function validateSession(token: string): Promise<JWTPayload | null> {
  try {
    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return null;
    }

    // Check if session is active
    const result = await query(
      'SELECT is_active, expires_at FROM sessions WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return null;
    }

    // Check expiration
    if (new Date(result.rows[0].expires_at) < new Date()) {
      await query('UPDATE sessions SET is_active = false WHERE token = $1', [
        token,
      ]);
      return null;
    }

    // Update last activity
    await query('UPDATE sessions SET last_activity = NOW() WHERE token = $1', [
      token,
    ]);

    return payload;
  } catch (error) {
    logger.error('Session validation failed', { error });
    return null;
  }
}
