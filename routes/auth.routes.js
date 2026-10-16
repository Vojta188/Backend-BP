import express from "express";
import { registrace, login } from "../controllers/auth.controller.js";
import { limitLogin, limitRegistrace } from "../middlewares/rateLimit.js";

const router = express.Router();

router.post("/registrace", limitRegistrace, registrace);
router.post("/login", limitLogin, login);

export default router;
