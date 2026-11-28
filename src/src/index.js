import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

// Payments go straight to Mollik's MetaMask wallet on Base. No money
// leaves his wallet to run this API; buyers pay INTO this address.
const PAY_TO = "0x85bc619349f7e8603eaf94c886556470f2c95024";
const PRICE = "$0.005"; // USDC on Base, per call

// One quote per day, picked by date so the answer is stable all day
// (vAPI checks hourly — a stable answer can never fail on content).
const QUOTES = [
  { quote: "Slow is smooth, smooth is fast.", author: "Navy SEAL saying" },
  { quote: "The best time to start was yesterday. The next best time is now.", author: "Proverb" },
  { quote: "Little by little, a little becomes a lot.", author: "Tanzanian proverb" },
  { quote: "The hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie" },
  { quote: "It always seems impossible until it is done.", author: "Nelson Mandela" },
  { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
];

// x402 v2 resource server. The default x402.org facilitator only
// supports testnets, so this uses PayAI's public facilitator, which
// supports exact-scheme payments on Base mainnet (eip155:8453).
// No API key, no account — the facilitator only verifies/setlles.
//
// v1.1.1: diagnostic logging around the facilitator calls. Paid calls
// from the vapi CLI kept failing with "HTTP 402 after receiving the
// authorization" (3 attempts, CLI 0.15.0 and 0.16.0), while the same
// CLI pays other v2 APIs fine — so the failure is in this server's
// verify step. These logs show the exact facilitator error in the
// Railway deploy logs. No payment behaviour is changed.
class LoggingFacilitatorClient extends HTTPFacilitatorClient {
  async verify(paymentPayload, paymentRequirements) {
    console.log(
      "[x402] verify: network=" +
        paymentRequirements?.network +
        " amount=" +
        paymentRequirements?.amount +
        " payTo=" +
        paymentRequirements?.payTo,
    );
    try {
      const res = await super.verify(paymentPayload, paymentRequirements);
      console.log("[x402] verify result: " + JSON.stringify(res).slice(0, 600));
      return res;
    } catch (err) {
      console.log(
        "[x402] verify ERROR: " + (err?.message || err) + " | " + String(err).slice(0, 600),
      );
      throw err;
    }
  }

  async settle(paymentPayload, paymentRequirements) {
    console.log("[x402] settle called");
    try {
      const res = await super.settle(paymentPayload, paymentRequirements);
      console.log("[x402] settle result: " + JSON.stringify(res).slice(0, 600));
      return res;
    } catch (err) {
      console.log(
        "[x402] settle ERROR: " + (err?.message || err) + " | " + String(err).slice(0, 600),
      );
      throw err;
    }
  }
}

const facilitatorClient = new LoggingFacilitatorClient({
  url: "https://facilitator.payai.network",
});
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  "eip155:8453",
  new ExactEvmScheme(),
);

const app = new Hono();

// Log every request: method, path, whether a payment header was sent,
// and the response status. This is what was missing when the paid
// calls failed — the Railway logs had no request lines at all.
app.use("*", async (c, next) => {
  const h = c.req.header("x-payment");
  console.log(
    `[http] ${c.req.method} ${c.req.path} x-payment=${h ? "yes len=" + h.length : "no"}`,
  );
  await next();
  console.log(`[http] ${c.req.method} ${c.req.path} -> ${c.res.status}`);
});

// Paid endpoint: $0.005 USDC on Base (x402 v2, exact scheme).
// Unpaid requests get HTTP 402 with the payment details — that is the
// x402 protocol, not an error. No API key, no account, no signup.
app.use(
  paymentMiddleware(
    {
      "GET /quote": {
        accepts: [
          {
            scheme: "exact",
            price: PRICE,
            network: "eip155:8453",
            payTo: PAY_TO,
            maxTimeoutSeconds: 60,
          },
        ],
        description: "One daily motivational quote. $0.005 USDC per call on Base.",
      },
    },
    resourceServer,
  ),
);

// Free: service info (lets vAPI and humans see what this is).
app.get("/", (c) =>
  c.json({
    name: "Mollik Daily Quote API",
    paid_endpoint: "GET /quote — $0.005 USDC on Base (x402 v2)",
    payTo: PAY_TO,
    docs: "/llms.txt",
    health: "/health",
  }),
);

// Free: health check — always 200 so uptime monitors stay green.
app.get("/health", (c) => c.json({ ok: true, time: new Date().toISOString() }));

// Free: agent-readable docs, served as plain text.
app.get("/llms.txt", (c) => {
  const text = [
    "# Mollik Daily Quote API",
    "",
    "One motivational quote per day. Paid endpoint, no API key, no account.",
    "",
    "## Paid endpoint",
    "- GET /quote — price $0.005 USDC on Base, paid in x402 v2 (HTTP 402 first).",
    "- Pay to: 0x85bc619349f7e8603eaf94c886556470f2c95024",
    "- Response: { quote, author, date }",
    "",
    "## Free endpoints",
    "- GET / — service info (JSON)",
    "- GET /health — { ok: true }",
  ].join("\n");
  return c.text(text, 200, { "Content-Type": "text/plain; charset=utf-8" });
});

// Paid: only runs after the $0.005 payment is verified and settled.
app.get("/quote", (c) => {
  const day = Math.floor(Date.now() / 86_400_000);
  const pick = QUOTES[day % QUOTES.length];
  return c.json({
    quote: pick.quote,
    author: pick.author,
    date: new Date().toISOString().slice(0, 10),
  });
});

const port = Number(process.env.PORT || 3000);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Mollik Daily Quote API listening on http://localhost:${info.port}`);
  console.log(`Paid endpoint: GET /quote — ${PRICE} USDC on Base (x402 v2), payTo ${PAY_TO}`);
});
