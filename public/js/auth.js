/**
 * Client-Side Authentication Utility
 * Handles login, logout, session management, and Google OAuth
 */

const AUTH_API = '/api/auth';

class AuthManager {
  constructor() {
    this.user = null;
    this.token = null;
    this.refreshToken = null;
    this.init();
  }

  /**
   * Initialize auth from localStorage
   */
  init() {
    this.token = localStorage.getItem('auth_token');
    this.refreshToken = localStorage.getItem('refresh_token');
    const userJson = localStorage.getItem('user');
    if (userJson) {
      try {
        this.user = JSON.parse(userJson);
      } catch (e) {
        console.error('Failed to parse user data', e);
        this.clearAuth();
      }
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  /**
   * Get current user
   */
  getUser() {
    return this.user;
  }

  /**
   * Get auth token
   */
  getToken() {
    return this.token;
  }

  /**
   * Save auth data to localStorage
   */
  saveAuth(data) {
    this.user = data.user;
    this.token = data.token;
    this.refreshToken = data.refreshToken || this.refreshToken;

    localStorage.setItem('auth_token', this.token);
    localStorage.setItem('user', JSON.stringify(this.user));
    if (this.refreshToken) {
      localStorage.setItem('refresh_token', this.refreshToken);
    }
  }

  /**
   * Clear auth data
   */
  clearAuth() {
    this.user = null;
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }

  /**
   * Register new user
   */
  async register(email, password, displayName) {
    try {
      const response = await fetch(`${AUTH_API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.details?.[0] || 'Registration failed');
      }

      this.saveAuth(data.data);
      return { success: true, user: this.user };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Login with email/password
   */
  async login(email, password) {
    try {
      const response = await fetch(`${AUTH_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      this.saveAuth(data.data);
      return { success: true, user: this.user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Login with Google
   */
  async loginWithGoogle(credential) {
    try {
      const response = await fetch(`${AUTH_API}/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Google login failed');
      }

      this.saveAuth(data.data);
      return { success: true, user: this.user };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      if (this.token) {
        await fetch(`${AUTH_API}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${AUTH_API}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      this.token = data.data.token;
      localStorage.setItem('auth_token', this.token);

      return { success: true };
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearAuth();
      return { success: false };
    }
  }

  /**
   * Make authenticated API request
   */
  async fetch(url, options = {}) {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.token}`,
    };

    try {
      let response = await fetch(url, { ...options, headers });

      // If token expired, try to refresh
      if (response.status === 401 && this.refreshToken) {
        const refreshResult = await this.refreshAccessToken();
        if (refreshResult.success) {
          // Retry request with new token
          headers['Authorization'] = `Bearer ${this.token}`;
          response = await fetch(url, { ...options, headers });
        } else {
          // Refresh failed, redirect to login
          window.location.href = '/login.html';
          return null;
        }
      }

      return response;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  /**
   * Require authentication (redirect if not authenticated)
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login.html?return=${returnUrl}`;
      return false;
    }
    return true;
  }

  /**
   * Redirect if already authenticated
   */
  redirectIfAuthenticated(defaultPath = '/') {
    if (this.isAuthenticated()) {
      const urlParams = new URLSearchParams(window.location.search);
      const returnUrl = urlParams.get('return') || defaultPath;
      window.location.href = decodeURIComponent(returnUrl);
      return true;
    }
    return false;
  }
}

// Create global auth instance
window.auth = new AuthManager();
