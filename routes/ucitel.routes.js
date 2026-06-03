import express from "express";
import { overeniTokenu } from "../middlewares/overeniTokenu.js";
import { jenUcitel } from "../middlewares/roleMiddleware.js";
import { seznamStudentuUcitel } from "../controllers/ucitel.controller.js";

const router = express.Router();

router.get("/studenti", overeniTokenu, jenUcitel, seznamStudentuUcitel);

export default router;