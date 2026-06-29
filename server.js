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

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001"
}));
app.use(express.json());
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
console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);

app.listen(PORT, () => {
  console.log("Server běží na portu " + PORT);
});
