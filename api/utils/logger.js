const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // Railway parses JSON logs automatically in Log Explorer
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  // Reduce noise in production
  ...(process.env.VERCEL_ENV === "production"
    ? {}
    : { transport: { target: "pino/file", options: { destination: 1 } } }),
});

module.exports = logger;
