import express from "express";
import { ziskejOtazky } from "../controllers/otazky.controller.js";
import { overeniTokenu } from "../middlewares/overeniTokenu.js";
import { jenUcitel } from "../middlewares/roleMiddleware.js";
import { upravOtazku, smazOtazku } from "../controllers/otazky.controller.js";

const router = express.Router();

router.get("/:lessonId", overeniTokenu, ziskejOtazky);
router.put("/:id", overeniTokenu, jenUcitel, upravOtazku);
router.delete("/:id", overeniTokenu, jenUcitel, smazOtazku);


export default router;
