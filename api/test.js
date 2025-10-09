// api/test.js
// This is a minimal serverless function to test the Vercel deployment process.
// It has no external dependencies and uses the standard Vercel handler format.
export default function handler(request, response) {
  // It returns a simple success response. If this function can be deployed,
  // it confirms the basic Node.js runtime environment on Vercel is working correctly.
  response.status(200).send("Hello, World! This is the test function.");
}
