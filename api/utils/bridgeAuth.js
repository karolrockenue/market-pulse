/**
 * @file bridgeAuth.js
 * @brief Security middleware for the AI Bridge (Sentinel <-> DGX).
 * Enforces use of the SENTINEL_DGX_KEY environment variable.
 */

const bridgeAuth = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const validKey = process.env.SENTINEL_DGX_KEY;

  // 1. Fail closed if no key is configured on server
  if (!validKey) {
    console.error(
      "[Bridge Auth] FATAL: SENTINEL_DGX_KEY not set in environment."
    );
    return res.status(500).json({
      success: false,
      message: "Bridge security configuration error.",
    });
  }

  // 2. Validate Key
  if (!apiKey || apiKey !== validKey) {
    console.warn(`[Bridge Auth] Unauthorized access attempt from ${req.ip}`);
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid Bridge Key.",
    });
  }

  // 3. Pass
  next();
};

module.exports = bridgeAuth;
