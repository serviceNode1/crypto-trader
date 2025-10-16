import axios from 'axios';
import { logger } from '../utils/logger';

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function testAuth() {
  logger.info('🧪 Starting authentication tests...\n');

  let token = '';
  let refreshToken = '';

  // Test 1: Register new user
  try {
    logger.info('Test 1: Register new user');
    const response = await axios.post(`${API_BASE}/auth/register`, {
      email: `test${Date.now()}@example.com`,
      password: 'Test123!@#',
      displayName: 'Test User',
    });

    if (response.data.success && response.data.data.token) {
      token = response.data.data.token;
      refreshToken = response.data.data.refreshToken;
      logger.info('✅ PASSED: User registered successfully');
      results.push({ test: 'Register new user', passed: true });
    } else {
      throw new Error('No token received');
    }
  } catch (error: any) {
    logger.error('❌ FAILED: Registration failed', { error: error.message });
    results.push({ test: 'Register new user', passed: false, error: error.message });
  }

  // Test 2: Login with default admin
  try {
    logger.info('\nTest 2: Login with default admin');
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@example.com',
      password: 'password123',
    });

    if (response.data.success && response.data.data.token) {
      token = response.data.data.token;
      refreshToken = response.data.data.refreshToken;
      logger.info('✅ PASSED: Admin login successful');
      results.push({ test: 'Login with admin', passed: true });
    } else {
      throw new Error('Login failed');
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.response?.data?.details || error.message;
    logger.error('❌ FAILED: Admin login failed', { 
      error: errorMsg,
      status: error.response?.status,
      data: error.response?.data
    });
    results.push({ test: 'Login with admin', passed: false, error: errorMsg });
  }

  // Test 3: Get user profile (authenticated)
  try {
    logger.info('\nTest 3: Get user profile (authenticated)');
    const response = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data.success && response.data.data.email) {
      logger.info(`✅ PASSED: Got profile for ${response.data.data.email}`);
      results.push({ test: 'Get user profile', passed: true });
    } else {
      throw new Error('No profile data');
    }
  } catch (error: any) {
    logger.error('❌ FAILED: Get profile failed', { error: error.message });
    results.push({ test: 'Get user profile', passed: false, error: error.message });
  }

  // Test 4: Check auth status
  try {
    logger.info('\nTest 4: Check authentication status');
    const response = await axios.get(`${API_BASE}/auth/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data.success && response.data.authenticated === true) {
      logger.info('✅ PASSED: Auth status confirmed');
      results.push({ test: 'Check auth status', passed: true });
    } else {
      throw new Error('Not authenticated');
    }
  } catch (error: any) {
    logger.error('❌ FAILED: Auth status check failed', { error: error.message });
    results.push({ test: 'Check auth status', passed: false, error: error.message });
  }

  // Test 5: Refresh token
  try {
    logger.info('\nTest 5: Refresh access token');
    const response = await axios.post(`${API_BASE}/auth/refresh`, {
      refreshToken,
    });

    if (response.data.success && response.data.data.token) {
      token = response.data.data.token;
      logger.info('✅ PASSED: Token refreshed successfully');
      results.push({ test: 'Refresh token', passed: true });
    } else {
      throw new Error('Token refresh failed');
    }
  } catch (error: any) {
    logger.error('❌ FAILED: Token refresh failed', { error: error.message });
    results.push({ test: 'Refresh token', passed: false, error: error.message });
  }

  // Test 6: Invalid token (should fail)
  try {
    logger.info('\nTest 6: Invalid token (should fail)');
    await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: 'Bearer invalid-token-here' },
    });

    logger.error('❌ FAILED: Invalid token was accepted!');
    results.push({ test: 'Reject invalid token', passed: false, error: 'Token was accepted' });
  } catch (error: any) {
    if (error.response?.status === 401) {
      logger.info('✅ PASSED: Invalid token rejected correctly');
      results.push({ test: 'Reject invalid token', passed: true });
    } else {
      logger.error('❌ FAILED: Unexpected error', { error: error.message });
      results.push({ test: 'Reject invalid token', passed: false, error: error.message });
    }
  }

  // Test 7: Logout
  try {
    logger.info('\nTest 7: Logout user');
    const response = await axios.post(
      `${API_BASE}/auth/logout`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.success) {
      logger.info('✅ PASSED: Logout successful');
      results.push({ test: 'Logout user', passed: true });
    } else {
      throw new Error('Logout failed');
    }
  } catch (error: any) {
    logger.error('❌ FAILED: Logout failed', { error: error.message });
    results.push({ test: 'Logout user', passed: false, error: error.message });
  }

  // Test 8: Use logged out token (should fail)
  try {
    logger.info('\nTest 8: Use logged out token (should fail)');
    await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    logger.error('❌ FAILED: Logged out token was accepted!');
    results.push({ test: 'Reject logged out token', passed: false, error: 'Token still valid' });
  } catch (error: any) {
    if (error.response?.status === 401) {
      logger.info('✅ PASSED: Logged out token rejected correctly');
      results.push({ test: 'Reject logged out token', passed: true });
    } else {
      logger.error('❌ FAILED: Unexpected error', { error: error.message });
      results.push({ test: 'Reject logged out token', passed: false, error: error.message });
    }
  }

  // Print summary
  logger.info('\n' + '='.repeat(50));
  logger.info('📊 TEST SUMMARY');
  logger.info('='.repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    logger.info(`${icon} ${result.test}${result.error ? ` - ${result.error}` : ''}`);
  });

  logger.info('\n' + '='.repeat(50));
  logger.info(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  logger.info('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

testAuth().catch((error) => {
  logger.error('Test suite failed', { error });
  process.exit(1);
});
