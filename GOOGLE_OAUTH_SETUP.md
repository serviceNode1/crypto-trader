# 🔐 Google OAuth Setup Guide

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it "Crypto AI Trading" (or your preferred name)
4. Click **Create**

## Step 2: Enable Google+ API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click **Enable**

## Step 3: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - **User Type:** External (for development)
   - **App name:** Crypto AI Trading
   - **User support email:** Your email
   - **Developer contact:** Your email
   - Click **Save and Continue**
   - **Scopes:** No need to add any (click Save and Continue)
   - **Test users:** Add your email address
   - Click **Save and Continue**

4. Create OAuth Client ID:
   - **Application type:** Web application
   - **Name:** Crypto AI Trading Web Client
   - **Authorized JavaScript origins:**
     ```
     http://localhost:3000
     ```
   - **Authorized redirect URIs:**
     ```
     http://localhost:3000
     ```
   - Click **Create**

5. **Copy your Client ID** (looks like: `123456789-abc123.apps.googleusercontent.com`)

## Step 4: Add to .env

Add your Google Client ID to `.env`:

```bash
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

## Step 5: Test Google OAuth

### Option A: Test with HTML Page

Create a simple test page at `public/test-google-auth.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test Google OAuth</title>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <h1>Test Google Sign-In</h1>
  
  <div id="g_id_onload"
       data-client_id="YOUR_CLIENT_ID_HERE"
       data-callback="handleCredentialResponse">
  </div>
  <div class="g_id_signin" data-type="standard"></div>

  <div id="result" style="margin-top: 20px;"></div>

  <script>
    function handleCredentialResponse(response) {
      console.log("Encoded JWT ID token: " + response.credential);
      
      // Send to your backend
      fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: response.credential
        })
      })
      .then(res => res.json())
      .then(data => {
        document.getElementById('result').innerHTML = 
          '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
      })
      .catch(error => {
        console.error('Error:', error);
        document.getElementById('result').innerHTML = 
          '<p style="color: red;">Error: ' + error.message + '</p>';
      });
    }
  </script>
</body>
</html>
```

Replace `YOUR_CLIENT_ID_HERE` with your actual Google Client ID.

### Option B: Test with cURL

```bash
# Get a test token from https://developers.google.com/identity/gsi/web/tools/configurator
# Then:

curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"credential":"YOUR_GOOGLE_ID_TOKEN_HERE"}'
```

## API Endpoints

### Login/Register with Google

```http
POST /api/auth/google
Content-Type: application/json

{
  "credential": "google-id-token-from-sign-in-button"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Google authentication successful",
  "data": {
    "user": {
      "id": 2,
      "email": "user@gmail.com",
      "displayName": "John Doe",
      "profilePictureUrl": "https://...",
      "googleId": "1234567890",
      "emailVerified": true,
      "isActive": true,
      "isAdmin": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2025-10-17T10:00:00.000Z"
  }
}
```

### Unlink Google Account

```http
POST /api/auth/google/unlink
Authorization: Bearer YOUR_JWT_TOKEN

{}
```

**Response:**
```json
{
  "success": true,
  "message": "Google account unlinked successfully"
}
```

## How It Works

### Account Linking

1. **First-time Google user:** Creates new account automatically
2. **Existing email match:** Links Google to existing account
3. **Existing Google user:** Logs in with existing account

### Security Features

✅ **Token Verification:** Verifies Google ID token server-side
✅ **Email Verified:** Uses Google's email verification
✅ **Account Linking:** Safely links Google to existing accounts
✅ **Unlink Protection:** Requires password if unlinking (can't be locked out)
✅ **Profile Sync:** Updates profile picture from Google

## Production Checklist

Before deploying to production:

- [ ] Add production domain to **Authorized JavaScript origins**
- [ ] Add production domain to **Authorized redirect URIs**
- [ ] Set up **OAuth consent screen** for production (verify domain)
- [ ] Update `GOOGLE_CLIENT_ID` in production `.env`
- [ ] Use HTTPS in production
- [ ] Test Google Sign-In from production domain

## Troubleshooting

### "Invalid token"
- Check that `GOOGLE_CLIENT_ID` in `.env` matches your Google Cloud Console
- Verify the token hasn't expired (tokens are short-lived)

### "Origin mismatch"
- Add your domain to **Authorized JavaScript origins** in Google Cloud Console

### "Redirect URI mismatch"
- Add your callback URL to **Authorized redirect URIs**

### "Cannot unlink Google account"
- User needs to set a password first (use password reset flow)

## Resources

- [Google Sign-In for Web](https://developers.google.com/identity/gsi/web/guides/overview)
- [Google OAuth2 Playground](https://developers.google.com/oauthplayground/)
- [Google API Console](https://console.cloud.google.com/)
