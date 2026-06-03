import express from "express";
import { odesliOdpoved } from "../controllers/odpovedi.controller.js";
import { overeniTokenu } from "../middlewares/overeniTokenu.js";
import { jenStudent } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.post("/", overeniTokenu, jenStudent, odesliOdpoved);

export default router;