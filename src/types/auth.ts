export interface User {
  id: number;
  email: string;
  displayName?: string;
  googleId?: string;
  profilePictureUrl?: string;
  emailVerified: boolean;
  isActive: boolean;
  isAdmin: boolean;
  failedLoginAttempts: number;
  lastFailedLogin?: Date;
  lockedUntil?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  id: number;
  userId: number;
  token: string;
  refreshToken?: string;
  expiresAt: Date;
  refreshExpiresAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
}

export interface PasswordResetToken {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  ipAddress?: string;
  createdAt: Date;
}

export interface AuditLogEntry {
  id?: number;
  userId?: number;
  action: string;
  resourceType?: string;
  resourceId?: number;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  createdAt?: Date;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  displayName?: string;
}

export interface GoogleAuthData {
  googleId: string;
  email: string;
  displayName?: string;
  profilePictureUrl?: string;
  emailVerified: boolean;
}

export interface JWTPayload {
  userId: number;
  email: string;
  isAdmin: boolean;
  sessionId: number;
}

export interface AuthResponse {
  user: Omit<User, 'failedLoginAttempts' | 'lastFailedLogin' | 'lockedUntil'>;
  token: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}
