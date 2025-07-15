// /api/utils/middleware.js

// Checks if a user is logged in for API endpoints.
const requireUserApi = (req, res, next) => {
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ error: "Unauthorized: User session required." });
  }
  next();
};

// Checks if the logged-in user is an administrator.
const requireAdminApi = (req, res, next) => {
  // It first checks if the user is logged in at all.
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ error: "Unauthorized: User session required." });
  }
  // Then it checks for the isAdmin flag.
  if (!req.session.isAdmin) {
    return res
      .status(403)
      .json({ error: "Forbidden: Administrator access required." });
  }
  next();
};

// This middleware is used for protecting entire pages, not just API calls.
const requirePageLogin = (req, res, next) => {
  if (!req.session.userId) {
    // If not logged in, redirect to the main sign-in page.
    return res.redirect("/signin");
  }
  next();
};

// Export all the middleware functions.
module.exports = {
  requireUserApi,
  requireAdminApi,
  requirePageLogin,
};
