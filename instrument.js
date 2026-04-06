const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.RAILWAY_ENVIRONMENT_NAME || process.env.VERCEL_ENV || "development",
  sendDefaultPii: true,
  tracesSampleRate: 0.1,
});
