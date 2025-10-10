module.exports = async (req, res) => {
  // We are not using any external libraries for this test.
  const { secret, startDay, endDay } = req.query;
  const jobLabel = `[Worker for days ${startDay}-${endDay}]`;

  // This is the first and only log we expect to see.
  console.log(
    `${jobLabel} --- BARE MINIMUM TEST: Worker started successfully.`
  );

  // For this test, we'll just send an immediate success response.
  res
    .status(200)
    .send(`Success: Bare minimum test for ${jobLabel} was successful.`);
};
