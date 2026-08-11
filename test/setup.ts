Object.assign(process.env, {
  NODE_ENV: "test",
  APP_URL: "https://intellihire.test",
  API_URL: "https://intellihire.test",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  GOOGLE_REDIRECT_URI: "https://intellihire.test/api/auth/google/callback",
  SESSION_SECRET: "test-session-secret-at-least-32-characters-long",
});
