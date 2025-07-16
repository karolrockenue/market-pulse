// This object provides standardized logging functions.
const logger = {
  // Use this to log specific, successful events.
  info: (source, message, data = "") => {
    console.log(
      `%c[INFO | ${source}]`, // Styling for the log source
      "color: #1e40af; font-weight: bold;",
      message,
      data // Any additional data to inspect
    );
  },
  // Use this inside a 'catch' block to log errors.
  error: (source, message, error) => {
    console.error(
      `%c[ERROR | ${source}]`, // Styling for the error source
      "color: #be123c; font-weight: bold;",
      message,
      {
        // Include detailed error information
        errorMessage: error.message,
        stackTrace: error.stack,
        errorObject: error,
      }
    );
  },
};

// This function sets up global listeners to catch any uncaught errors.
function initializeGlobalErrorHandling() {
  // Catches standard JavaScript errors.
  window.addEventListener("error", (event) => {
    logger.error(
      "Global",
      "An uncaught error occurred on the page.",
      event.error
    );
  });

  // Catches errors from failed Promises (e.g., in async functions).
  window.addEventListener("unhandledrejection", (event) => {
    logger.error(
      "Global",
      "An unhandled promise rejection occurred.",
      event.reason
    );
  });

  logger.info("Logger", "Global error handlers have been initialized.");
}

// Expose the logger object and the initialization function.
export { logger, initializeGlobalErrorHandling };
