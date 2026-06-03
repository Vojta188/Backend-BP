import express from "express";
import { ziskejPokrok } from "../controllers/pokrok.controller.js";
import { overeniTokenu } from "../middlewares/overeniTokenu.js";

const router = express.Router();

router.get("/", overeniTokenu, ziskejPokrok);

export default router;
