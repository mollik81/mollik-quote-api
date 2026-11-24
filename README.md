# Mollik Daily Quote API — vAPI "List your API" quest (500 pts)

Minimal paid x402 API, built 2026-11-24, tested locally. One paid endpoint,
no database, no external API, no secrets, no API key.

- **Paid:** `GET /quote` — **$0.005 USDC on Base**, per call, via x402.
  Payee is Mollik's MetaMask: `0x85bc619349f7e8603eaf94c886556470f2c95024`.
  Unpaid requests get HTTP 402 with the payment details (that is the
  protocol, not an error). Returns one motivational quote, stable per day:
  `{ quote, author, date }`.
- **Free:** `GET /` (service info), `GET /health` (`{ ok: true }`),
  `GET /llms.txt` (agent-readable docs, plain text).

## Verified locally (2026-11-24, Node v24) — v1.1.0, x402 v2

- `GET /` → 200, `GET /health` → 200, `GET /llms.txt` → 200
- `GET /quote` unpaid → **402** with:
  `x402Version: 2`, `scheme: exact`, `network: eip155:8453` (Base),
  `amount: "5000"` (= $0.005 USDC),
  `payTo: 0x85bc619349F7E8603EaF94C886556470F2C95024`,
  `asset: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (official USDC on Base),
  `maxTimeoutSeconds: 60`.
- v2 uses `@x402/hono` + `@x402/evm` (the old `x402-hono` v1 package is
  deprecated). Facilitator is PayAI's public one
  (`https://facilitator.payai.network`) because the default x402.org
  facilitator only supports testnets — PayAI supports exact payments on
  Base mainnet. No API key or account needed for it.
- A real paid call was NOT tested here — it needs a wallet signature, and
  only Mollik can sign from his wallet. vAPI's own probe does the paid
  check after listing; if it fails, the 402 above is the first thing to
  re-check.

## Update note (2026-11-24 11:07 +06)

v1.0.0 served x402 **v1**; the vAPI wizard requires **v2**
("vAPI lists x402 v2 offers only", code `v1_legacy`). v1.1.0 fixes that.
To update a deployed copy: upload these files to the same GitHub repo
again (drag-and-drop replaces them) — Railway redeploys automatically,
then re-run the wizard's Discover check with the same `/quote` URL.

## Run locally

```bash
npm install
npm start   # listens on http://localhost:3000 (or $PORT)
curl http://localhost:3000/quote   # expect HTTP 402, see payment details
```

## Host free (Railway — his PC steps, one screen at a time)

1. Push this folder to a new GitHub repo (e.g. `mollik-quote-api`).
2. railway.app → New Project → Deploy from GitHub repo → pick the repo.
3. Railway auto-detects Node. Start command: `npm start`. It sets `$PORT`
   itself — no env vars or secrets needed.
4. Deploy → Settings → Networking → Generate Domain → copy the public
   `https://...up.railway.app` URL. `curl <url>/` must return 200 and
   `curl <url>/quote` must return 402.
5. Render works the same way (Web Service, build `npm install`,
   start `npm start`, free tier) if Railway asks for a card.

## Publish on vAPI (wizard at api.vapinetwork.ai/call/my-apis/new)

1. **Discover** — paste the FULL endpoint URL with the path, e.g.
   `https://<your-app>.up.railway.app/quote` (the bare origin alone
   returns 200, not 402 — the wizard needs the `/quote` path).
2. **Describe** — name "Mollik Daily Quote API", description
   "One motivational quote per day, $0.005 USDC per call on Base (x402)".
3. **Payout signature** — sign from MetaMask
   `0x85bc...95024` to prove the payTo wallet is his.
4. **Go live** — listing appears; the 500-pt quest should auto-complete.
5. Keep it live: vAPI checks hourly, 3 consecutive failures suspend the
   listing. The quote is picked by date and needs no outside service, so
   the hourly check cannot fail on content.

## Money

- Listing is free. Running it costs nothing from his wallet.
- Every paid call sends $0.005 USDC **into** his MetaMask on Base.
- No seed phrase, private key or Router key is used anywhere in this code.
