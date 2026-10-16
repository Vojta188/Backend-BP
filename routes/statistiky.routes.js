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
router.get("/ucitel/prehled", overeniTokenu, jenUcitel, ucitelPrehled);

// detail lekce
router.get("/ucitel/lekce/:lessonId", overeniTokenu, jenUcitel, ucitelLekceDetail);

// detail studenta 
router.get("/ucitel/student/:studentId", overeniTokenu, jenUcitel, ucitelStudentDetail);

export default router;
