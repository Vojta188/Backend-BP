import express from "express";
import { vytvorLekci, schvalLekci, ziskejLekce } from "../controllers/lekce.controller.js";
import { overeniTokenu } from "../middlewares/overeniTokenu.js";
import { jenUcitel } from "../middlewares/roleMiddleware.js";
import { detailLekce } from "../controllers/lekce.controller.js";
import { upravLekci } from "../controllers/lekce.controller.js";
import { smazLekci } from "../controllers/lekce.controller.js";
import {
  ziskejPrirazeni,
  nastavCiloveZaky,
} from "../controllers/lekce.controller.js";
import { prehledZakuLekce, pridejZakyDoLekce } from "../controllers/lekce.controller.js";

const router = express.Router();

router.post("/vytvor", overeniTokenu, jenUcitel, vytvorLekci);
router.post("/schval/:id", overeniTokenu, jenUcitel, schvalLekci);
router.get("/", overeniTokenu, ziskejLekce);
router.get("/:id/detail", overeniTokenu, detailLekce);
router.delete("/:id", overeniTokenu, jenUcitel, smazLekci);

// detail pro kontrolu (učitel i student, ale student uvidí jen schválené – to můžeš řešit později)
router.get("/:id/detail", overeniTokenu, detailLekce);

// editace lekce – jen učitel
router.put("/:id", overeniTokenu, jenUcitel, upravLekci);

router.get("/:id/prirazeni", overeniTokenu, jenUcitel, ziskejPrirazeni);
router.post("/:id/prirazeni", overeniTokenu, jenUcitel, nastavCiloveZaky);
router.get("/:id/prehled-zaku", overeniTokenu, jenUcitel, prehledZakuLekce);
router.post("/:id/pridat-zaky", overeniTokenu, jenUcitel, pridejZakyDoLekce);
export default router;
