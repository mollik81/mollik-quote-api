import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { paymentMiddleware } from "x402-hono";

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
  { quote: "Do the hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie" },
  { quote: "It always seems impossible until it is done.", author: "Nelson Mandela" },
  { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
];

const app = new Hono();

// Paid endpoint: $0.005 USDC on Base, verified by the x402 facilitator.
// Unpaid requests get HTTP 402 with the payment details — that is the
// x402 protocol, not an error. No API key, no account, no signup.
app.use(
  paymentMiddleware(PAY_TO, {
    "/quote": {
      price: PRICE,
      network: "base",
      config: {
        description: "One daily motivational quote. $0.005 USDC per call on Base.",
        mimeType: "application/json",
        maxTimeoutSeconds: 60,
        outputSchema: {
          type: "object",
          properties: {
            quote: { type: "string" },
            author: { type: "string" },
            date: { type: "string" },
          },
        },
      },
    },
  }),
);

// Free: service info (lets vAPI and humans see what this is).
app.get("/", (c) =>
  c.json({
    name: "Mollik Daily Quote API",
    paid_endpoint: "GET /quote — $0.005 USDC on Base (x402)",
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
    "- GET /quote — price $0.005 USDC on Base, paid in x402 (HTTP 402 first).",
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
  console.log(`Paid endpoint: GET /quote — ${PRICE} USDC on Base, payTo ${PAY_TO}`);
});
