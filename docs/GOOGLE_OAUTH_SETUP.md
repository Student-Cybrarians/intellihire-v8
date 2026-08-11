# Google Cloud OAuth Setup

## 1. Create OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create
   or select a project.
2. **APIs & Services → OAuth consent screen**: configure the consent screen
   (External, unless this is Workspace-internal). Add your support email and
   the scopes `openid`, `email`, `profile` (these are the only scopes this
   app requests).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `IntelliHire` (or `IntelliHire — local`, `IntelliHire — staging`,
     etc. if you keep separate credentials per environment)

## 2. Authorized JavaScript origins

Add the origin(s) serving the app — no path, no trailing slash:

- `http://localhost:3000` (local dev)
- `https://your-staging-domain.example.com`
- `https://your-production-domain.example.com`

## 3. Authorized redirect URIs

Must match `GOOGLE_REDIRECT_URI` **exactly**, including path:

- `http://localhost:3000/api/auth/google/callback`
- `https://your-staging-domain.example.com/api/auth/google/callback`
- `https://your-production-domain.example.com/api/auth/google/callback`

## 4. Populate environment variables

From the credential's details page:

```bash
GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback   # match step 3 exactly
```

`GOOGLE_CLIENT_SECRET` is a real secret: set it via your deploy platform's
environment/secrets manager (Vercel Project Settings → Environment
Variables, GitHub Actions Secrets, etc.), never in a committed file.

## 5. Verify the flow locally

```bash
npm run dev
```

Visit `http://localhost:3000`, click **Continue with Google**, and confirm:

- You land on Google's account chooser (`prompt=select_account` is set, so
  it won't silently reuse a cached session).
- After consenting, you're redirected back to `/dashboard` (or wherever
  `returnTo` pointed) and `GET /api/auth/me` returns your profile.
- A row appears in `users` keyed by your Google `sub`, and in `sessions`,
  `devices`, and `login_history`.

## Common misconfigurations

| Symptom | Likely cause |
| --- | --- |
| `redirect_uri_mismatch` from Google | `GOOGLE_REDIRECT_URI` doesn't byte-for-byte match an Authorized redirect URI in the Cloud Console |
| Callback redirects to `/?auth_error=invalid_id_token` | Clock skew, or `GOOGLE_CLIENT_ID` doesn't match the credential that issued the token (wrong project/env) |
| Callback redirects to `/?auth_error=email_not_verified` | The Google account's email isn't verified — expected behavior, not a bug |
| Works locally, fails in production | Production origin/redirect URI not added in step 2/3, or `APP_URL` env var doesn't match the deployed domain |
