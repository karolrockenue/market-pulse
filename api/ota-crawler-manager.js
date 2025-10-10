require("dotenv").config();

// The manager's only job is to break up the work and trigger the workers.
module.exports = async (req, res) => {
  // 1. Authenticate the request using the secret token.
  const { secret } = req.query;
  const crawlerSecret = process.env.CRAWLER_SECRET;

  if (!crawlerSecret || secret !== crawlerSecret) {
    console.warn("Unauthorized attempt to trigger the crawler manager.");
    return res.status(401).send("Unauthorized");
  }

  console.log("✅ Manager authenticated. Starting worker dispatch...");

  try {
    const TOTAL_DAYS = 120;
    const CHUNK_SIZE = 5;
    const workerUrls = [];

    // First, prepare all the worker URLs.
    for (let startDay = 0; startDay < TOTAL_DAYS; startDay += CHUNK_SIZE) {
      const endDay = Math.min(startDay + CHUNK_SIZE - 1, TOTAL_DAYS - 1);
      const workerUrl = `https://${process.env.VERCEL_URL}/api/ota-crawler?startDay=${startDay}&endDay=${endDay}&secret=${crawlerSecret}`;
      workerUrls.push({ url: workerUrl, range: `days ${startDay}-${endDay}` });
    }

    console.log(
      `Prepared ${workerUrls.length} worker jobs. Dispatching now...`
    );

    // Use Promise.allSettled to attempt all dispatches, even if some fail.
    const dispatchResults = await Promise.allSettled(
      workerUrls.map((job) => fetch(job.url))
    );

    let successCount = 0;
    let failureCount = 0;

    // Log the outcome of each individual dispatch.
    dispatchResults.forEach((result, index) => {
      const job = workerUrls[index];
      if (result.status === "fulfilled") {
        // A "fulfilled" status means the fetch request was successfully sent and acknowledged.
        console.log(`✅ Successfully dispatched worker for ${job.range}.`);
        successCount++;
      } else {
        // A "rejected" status means the fetch request itself failed.
        console.error(
          `❌ FAILED to dispatch worker for ${job.range}. Reason: ${result.reason}`
        );
        failureCount++;
      }
    });

    const summaryMessage = `Dispatch complete. Successful: ${successCount}, Failed: ${failureCount}.`;
    console.log(summaryMessage);
    res.status(200).send(summaryMessage);
  } catch (error) {
    console.error("A critical error occurred in the crawler manager:", error);
    res.status(500).send(`Manager failed: ${error.message}`);
  }
};
