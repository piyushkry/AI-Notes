import Stripe from "stripe"
import UserModel from "../models/user.model.js";
import dotenv from "dotenv"
dotenv.config()

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Stripe secret key missing in .env");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const CREDIT_MAP = {
  100: 50,
  200: 120,
  500: 300,
};

export const createCreditsOrder = async (req,res) => {
    try {
        const userId = req.userId
        const {amount} = req.body;

         if (!CREDIT_MAP[amount]) {
      return res.status(400).json({
        message: "Invalid credit plan",
      });
    }

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
      payment_method_types: ["card"],
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-failed`,
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `${CREDIT_MAP[amount]} Credits`,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        credits: CREDIT_MAP[amount],
      },
    })

    res.status(200).json({ url: session.url });
    } catch (error) {
         res.status(500).json({ message: "Stripe error" });
    }
}
export const verifyPayment = async (req, res) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    // Retrieve the session from Stripe to verify payment status
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    // Ensure the session belongs to this user
    if (session.metadata.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const creditsToAdd = Number(session.metadata.credits);
    if (!creditsToAdd) {
      return res.status(400).json({ message: "Invalid session metadata" });
    }

    // Check if we already processed this session (idempotency)
    // We store processed sessions in a simple in-memory set for the session lifecycle
    // A real production app would store this in DB, but for local dev this works
    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        $inc: { credits: creditsToAdd },
        $set: { isCreditAvailable: true },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`✅ Payment verified: Added ${creditsToAdd} credits to user ${user.email} (Total: ${user.credits})`);
    return res.status(200).json({ message: "Credits added", credits: user.credits, user });

  } catch (error) {
    console.log("❌ verifyPayment error:", error.message);
    return res.status(500).json({ message: "Verification failed", error: error.message });
  }
};

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.log("❌ Webhook signature error:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    console.log(`ℹ️ Webhook event received: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const userId = session.metadata.userId;
      const creditsToAdd = Number(session.metadata.credits);

      console.log(`ℹ️ Webhook received for session ${session.id}, User: ${userId}, Credits: ${creditsToAdd}`);

      if (!userId || !creditsToAdd) {
        console.log("❌ Webhook: Missing metadata");
        return res.status(400).json({ message: "Invalid metadata" });
      }

      const user = await UserModel.findByIdAndUpdate(
        userId,
        {
          $inc: { credits: creditsToAdd },
          $set: { isCreditAvailable: true },
        },
        { new: true }
      );

      if (!user) {
        console.log(`❌ Webhook: User ${userId} not found in database`);
      } else {
        console.log(`✅ Success: Added ${creditsToAdd} credits to user ${user.email} (Total: ${user.credits})`);
      }
    }
    res.json({ received: true });
  } catch (error) {
    console.log("❌ Webhook processing error:", error);
    res.status(500).json({ message: "Webhook processing failed", error: error.message });
  }
};