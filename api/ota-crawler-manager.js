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
    const CHUNK_SIZE = 5; // We'll process 5 days per worker function.
    const workerPromises = [];

    // 2. Loop and create chunks of work.
    for (let startDay = 0; startDay < TOTAL_DAYS; startDay += CHUNK_SIZE) {
      const endDay = Math.min(startDay + CHUNK_SIZE - 1, TOTAL_DAYS - 1);

      // 3. Construct the URL for the worker function.
      // We pass the start day, end day, and the secret.
      const workerUrl = `${process.env.VERCEL_URL}/api/ota-crawler?startDay=${startDay}&endDay=${endDay}&secret=${crawlerSecret}`;

      console.log(`  -> Dispatching worker for days ${startDay}-${endDay}`);

      // 4. Trigger the worker. We use fetch but don't wait for the response (fire and forget).
      // This allows all workers to run in parallel.
      workerPromises.push(fetch(workerUrl));
    }

    // Wait for all the trigger requests to be sent.
    await Promise.all(workerPromises);

    const message = `Successfully dispatched ${workerPromises.length} workers to cover ${TOTAL_DAYS} days.`;
    console.log(message);
    res.status(200).send(message);
  } catch (error) {
    console.error("Error in crawler manager:", error);
    res.status(500).send(`Manager failed: ${error.message}`);
  }
};
