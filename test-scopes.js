require("dotenv").config();
const fetch = require("node-fetch");

const CLOUDBEDS_CLIENT_ID = process.env.CLOUDBEDS_CLIENT_ID;
const CLOUDBEDS_REDIRECT_URI = process.env.CLOUDBEDS_REDIRECT_URI;

const testScopes = [
  "read:user",
  "read:hotel",
  "read:data-insights-reservations",
  "read:data-insights-occupancy",
  // add more scopes if needed
];

// Generates Cloudbeds OAuth URL for testing
function generateOAuthUrl(scopes) {
  const params = new URLSearchParams({
    client_id: CLOUDBEDS_CLIENT_ID,
    redirect_uri: CLOUDBEDS_REDIRECT_URI,
    response_type: "code",
    scope: scopes.join(" "),
  });

  return `https://hotels.cloudbeds.com/api/v1.2/oauth?${params.toString()}`;
}

// Step 1: Generate and log URLs for manual scope testing
console.log("🔗 OAuth URLs for manual testing:\n");
testScopes.forEach((scope) => {
  const url = generateOAuthUrl(["read:user", "read:hotel", scope]);
  console.log(`${scope} ➡️ ${url}\n`);
});
