import express from "express";
import { overeniTokenu } from "../middlewares/overeniTokenu.js";
import { jenStudent } from "../middlewares/roleMiddleware.js";
import { startAttempt, nextQuestion, finishAttempt } from "../controllers/test.controller.js";

const router = express.Router();

router.post("/:lessonId/start", overeniTokenu, jenStudent, startAttempt);
router.get("/:lessonId/next", overeniTokenu, jenStudent, nextQuestion);
router.post("/:lessonId/finish", overeniTokenu, jenStudent, finishAttempt);

export default router;