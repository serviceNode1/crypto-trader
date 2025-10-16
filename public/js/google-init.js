/**
 * Initialize Google Sign-In with dynamic Client ID
 */
(async function initGoogleSignIn() {
  try {
    const response = await fetch('/api/auth/config');
    const data = await response.json();
    
    if (data.success && data.data.googleClientId) {
      const clientId = data.data.googleClientId;
      
      // Update all Google Sign-In elements with the client ID
      const gOnloadElements = document.querySelectorAll('#g_id_onload');
      gOnloadElements.forEach(el => {
        el.setAttribute('data-client_id', clientId);
      });
      
      console.log('Google Sign-In initialized with Client ID');
    } else {
      console.warn('Google Client ID not configured');
      // Hide Google Sign-In buttons if not configured
      document.querySelectorAll('.google-btn-container').forEach(el => {
        el.style.display = 'none';
      });
      document.querySelectorAll('.divider').forEach(el => {
        el.style.display = 'none';
      });
    }
  } catch (error) {
    console.error('Failed to initialize Google Sign-In:', error);
  }
})();
