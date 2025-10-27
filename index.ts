import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
// Важно: если в твоей версии по-другому — замени импорт на правильный:
import { facilitator, settlePayment } from "x402-hono"; // или "x402-hono/core"

config();

const PUBLIC_URL = process.env.PUBLIC_URL || "mint134.up.railway.app";
const facilitatorUrl = process.env.FACILITATOR_URL!;
const payTo = process.env.ADDRESS as `0x${string}`;
const network = "base";

if (!facilitatorUrl || !payTo || !network) {
  console.error("Missing envs");
  process.exit(1);
}

const app = new Hono();
app.use("*", cors({ origin: "*", allowMethods: ["GET","POST","OPTIONS","HEAD"], allowHeaders: ["*"] }));

// единый хендлер: и 402 с resource, и 200 после оплаты
app.on(["GET","POST","OPTIONS","HEAD"], "/mint", async (c) => {
  if (c.req.method === "OPTIONS" || c.req.method === "HEAD") return c.text("", 204);

  const paymentData = c.req.header("x-payment") || null;

  const result = await settlePayment({
    resourceUrl: `${PUBLIC_URL}/mint`,     // ← КРИТИЧЕСКО: здесь задаём HTTPS-ресурс
    method: c.req.method,                  // повторяем тот же метод (POST)
    paymentData,
    payTo,
    network,
    price: { amount: "$0.001" },           // или твой точный прайс/токен
    facilitator: facilitator({ url: facilitatorUrl }),
  });

  if (result.status !== 200) {
    return new Response(result.responseBody, {
      status: result.status,
      headers: result.responseHeaders,
    });
  }

  return c.json({ ok: true, report: { weather: "sunny", temperature: 70 } });
});

const PORT = Number(process.env.PORT || 4021);
serve({ fetch: app.fetch, port: PORT });
