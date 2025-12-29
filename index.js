const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  try {
    const payload = JSON.parse(req.payload || "{}");
    const accountId = payload.accountId;

    if (!accountId) {
      return res.json({ error: "missing_accountId" }, 400);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: "https://your-tls-url/onboarding-refresh",
      return_url: "https://your-tls-url/onboarding-complete",
      type: "account_onboarding"
    });

    res.json({ url: link.url });
  } catch (err) {
    console.error(err);
    res.json({ error: "onboarding_failed" }, 500);
  }
};
