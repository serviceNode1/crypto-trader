import { Response } from 'express';
import { logger } from '../../utils/logger';

/**
 * Cookie-based authentication helper
 * Sets tokens in httpOnly cookies instead of response body
 * This prevents XSS attacks from stealing tokens
 */

const COOKIE_OPTIONS = {
  httpOnly: true, // Cannot be accessed by JavaScript
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict' as const, // CSRF protection
  path: '/',
};

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * Set authentication cookies
 */
export function setAuthCookies(
  res: Response,
  accessToken: string | undefined,
  refreshToken: string | undefined
): void {
  if (!accessToken || !refreshToken) {
    logger.error('Cannot set auth cookies: tokens are undefined');
    return;
  }
  // Access token (24 hours)
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Refresh token (30 days)
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  logger.debug('Auth cookies set');
}

/**
 * Clear authentication cookies (logout)
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, COOKIE_OPTIONS);
  res.clearCookie(REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS);
  logger.debug('Auth cookies cleared');
}

/**
 * Get access token from cookie
 */
export function getAccessTokenFromCookie(req: any): string | null {
  return req.cookies?.[ACCESS_TOKEN_COOKIE] || null;
}

/**
 * Get refresh token from cookie
 */
export function getRefreshTokenFromCookie(req: any): string | null {
  return req.cookies?.[REFRESH_TOKEN_COOKIE] || null;
}

/**
 * Cookie names (for reference)
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN: REFRESH_TOKEN_COOKIE,
};
