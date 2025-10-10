module.exports = async (req, res) => {
  // We are temporarily bypassing the secret check for this direct test.
  console.log("--- DEBUG MODE: GENERATING WORKER URL ---");

  const startDay = 0;
  const endDay = 4;
  const secret = process.env.CRAWLER_SECRET || "your-secret-password-here";

  // This uses your production domain if available, otherwise the Vercel URL.
  const baseUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

  const workerUrl = `https://${baseUrl}/api/ota-crawler?startDay=${startDay}&endDay=${endDay}&secret=${secret}`;

  console.log("\n--- COPY AND PASTE THIS URL INTO YOUR BROWSER ---\n");
  console.log(workerUrl);
  console.log("\n--------------------------------------------------\n");

  res
    .status(200)
    .send(
      `Debug mode: Worker URL has been logged. Please check your Vercel logs.`
    );
};
