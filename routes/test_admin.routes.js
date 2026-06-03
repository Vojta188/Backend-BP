import express from "express";
import { overeniTokenu } from "../middlewares/overeniTokenu.js";
import { jenUcitel } from "../middlewares/roleMiddleware.js";
import { povolOpakovani } from "../controllers/test_admin.controller.js";
import { povolOpakovaniHromadne } from "../controllers/test_admin.controller.js";

const router = express.Router();
router.post("/povolit-opakovani", overeniTokenu, jenUcitel, povolOpakovani);
router.post("/povolit-opakovani-hromadne", overeniTokenu, jenUcitel, povolOpakovaniHromadne);
export default router;