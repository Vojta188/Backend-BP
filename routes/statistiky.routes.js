import express from "express";
import { overeniTokenu } from "../middlewares/overeniTokenu.js";
import { jenUcitel } from "../middlewares/roleMiddleware.js";

import {
  ucitelPrehled,
  ucitelLekceDetail,
  ucitelStudentDetail,
} from "../controllers/statistiky.controller.js";

const router = express.Router();

// učitel přehled
// GET /api/statistiky/ucitel/prehled
router.get("/ucitel/prehled", overeniTokenu, jenUcitel, ucitelPrehled);

// detail lekce
// GET /api/statistiky/ucitel/lekce/:lessonId
router.get("/ucitel/lekce/:lessonId", overeniTokenu, jenUcitel, ucitelLekceDetail);

// detail studenta (jen v rámci učitelových lekcí)
// GET /api/statistiky/ucitel/student/:studentId
router.get("/ucitel/student/:studentId", overeniTokenu, jenUcitel, ucitelStudentDetail);

export default router;
