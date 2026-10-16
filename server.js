import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import testRoutes from "./routes/test.routes.js";
import authRoutes from "./routes/auth.routes.js";
import lekceRoutes from "./routes/lekce.routes.js";
import otazkyRoutes from "./routes/otazky.routes.js";
import odpovediRoutes from "./routes/odpovedi.routes.js";
import pokrokRoutes from "./routes/pokrok.routes.js";
import statistikyRoutes from "./routes/statistiky.routes.js";
import ucitelRoutes from "./routes/ucitel.routes.js";
import testAdminRoutes from "./routes/test_admin.routes.js";


dotenv.config();

const app = express();
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(proxyHops) && proxyHops > 0 && proxyHops <= 5) {
  app.set("trust proxy", proxyHops);
}

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Frame-Options", "DENY");
  next();
});
const allowedOrigins = (process.env.CORS_ORIGINS ||
  "http://localhost:3000,http://localhost:3001,https://frontend-bp.vercel.app")
  .split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "128kb" }));
app.use("/api/test", testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/lekce", lekceRoutes);
app.use("/api/otazky", otazkyRoutes);
app.use("/api/odpoved", odpovediRoutes);
app.use("/api/pokrok", pokrokRoutes);
app.use("/api/statistiky", statistikyRoutes);
app.use("/api/ucitel", ucitelRoutes);
app.use("/api/test-admin", testAdminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server běží na portu " + PORT);
});
