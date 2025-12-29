const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  try {
    const payload = JSON.parse(req.payload || "{}");

    const amount = Number(payload.amount);
    const helperAccountId = payload.helperAccountId;
    const requestId = payload.requestId;

    if (!amount || !helperAccountId) {
      return res.json({ error: "missing_fields" }, 400);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Laundry Request ${requestId}`
            },
            unit_amount: Math.round(amount * 100)
          },
          quantity: 1
        }
      ],
      payment_intent_data: {
        transfer_data: {
          destination: helperAccountId
        }
      },
      success_url: "https://your-tls-url/payment-success",
      cancel_url: "https://your-tls-url/payment-cancel",
      metadata: {
        requestId
      }
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error(err);
    res.json({ error: "payment_failed" }, 500);
  }
};
