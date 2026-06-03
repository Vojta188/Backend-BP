import express from "express";
import { registrace, login } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/registrace", registrace);
router.post("/login", login);

export default router;
