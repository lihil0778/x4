import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { paymentMiddleware, Network, Resource } from "x402-hono";
import { cors } from "hono/cors";

config();

const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
const payTo = process.env.ADDRESS as `0x${string}`;
const network = process.env.NETWORK as Network;

// ТВОЙ ПУБЛИЧНЫЙ HTTPS URL (этот же, что в x402scan)
const PUBLIC_HTTPS = "https://mint134.up.railway.app/mint";

// sanity-check env
if (!facilitatorUrl || !payTo || !network) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const app = new Hono();

// CORS до paywall (preflight из браузера/x402scan)
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS", "HEAD"],
    allowHeaders: ["*"],
  }),
);

// лог — видим метод и наличие x-payment
app.use("*", async (c, next) => {
  console.log("[REQ]", c.req.method, c.req.path, "x-payment:", !!c.req.header("x-payment"));
  return next();
});

console.log("Server is running");

// ⬇️ Указываем HTTPS resourceUrl на оба пути: `/weather` и `/weather/`
app.use(
  paymentMiddleware(
    payTo,
    {
      "/mint": {
        price: "$0.001",
        network,
        config: {
          resourceUrl: `${PUBLIC_HTTPS}/mint`,  // <— КРИТИЧЕСКОЕ МЕСТО
          description: "",
        },
      },
      "/mint/": {
        price: "$0.001",
        network,
        config: {
          resourceUrl: `${PUBLIC_HTTPS}/mint/`,
          description: "",
        },
      },
    },
    { url: facilitatorUrl },
  ),
);

// preflight/HEAD
app.on(["OPTIONS", "HEAD"], "/mint", (c) => c.text("", 204));
app.on(["OPTIONS", "HEAD"], "/mint/", (c) => c.text("", 204));

// принимаем и GET, и POST (x402scan ресабмитит тем же методом)
app.on(["GET", "POST"], "/mint", (c) =>
  c.json({ report: { mint: "done", minted: 1 }, method: c.req.method }),
);
app.on(["GET", "POST"], "/mint/", (c) =>
  c.json({ report: { mint: "done", minted: 1 }, method: c.req.method }),
);

serve({ fetch: app.fetch, port: Number(process.env.PORT || 4021) });

