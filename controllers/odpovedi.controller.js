import { db } from "../config/databaze.js";
import { generujVysvetleni } from "../services/vysvetleni.service.js";

export async function odesliOdpoved(req, res) {
  try {
    const studentId = req.user.id;
    const { questionId, answer } = req.body;

    if (!questionId || !answer) {
      return res.status(400).json({ error: "Chybí questionId nebo answer" });
    }

    // 1) najdeme otázku
    const [rows] = await db.query("SELECT * FROM questions WHERE id = ?", [questionId]);
    if (!rows.length) return res.status(404).json({ error: "Otázka neexistuje" });

    const q = rows[0];

    // 2) najdeme aktivní attempt pro tuhle lekci
    const [att] = await db.query(
      "SELECT id FROM lesson_attempts WHERE lesson_id = ? AND student_id = ? AND status='active' LIMIT 1",
      [q.lesson_id, studentId]
    );

    if (!att.length) {
      return res.status(400).json({ error: "Nejdřív spusť test (attempt)." });
    }

    const attemptId = att[0].id;

    // 3) normalizace odpovědí
    const studentAns = String(answer).trim().toUpperCase();
    const correctAns = String(q.correct || "").trim().toUpperCase();
    const jeSpravne = correctAns === studentAns;

    // 4) volitelné: zabráníme dvojité odpovědi na stejnou otázku v rámci attemptu
    const [dup] = await db.query(
      "SELECT id FROM answers WHERE attempt_id = ? AND question_id = ? LIMIT 1",
      [attemptId, questionId]
    );
    if (dup.length) {
      return res.status(400).json({ error: "Na tuto otázku už jsi v tomto pokusu odpověděl." });
    }

    // 5) AI vysvětlení
    let vysvetleni = null;
    if (!jeSpravne) {
      vysvetleni = await generujVysvetleni(q.question, correctAns, studentAns);
    }

    // 6) uložíme odpověď (už s attempt_id)
    const [ins] = await db.query(
      "INSERT INTO answers (student_id,question_id,lesson_id,attempt_id,answer,is_correct) VALUES (?,?,?,?,?,?)",
      [studentId, questionId, q.lesson_id, attemptId, studentAns, jeSpravne]
    );

    res.json({
      answerId: ins.insertId,
      correct: jeSpravne,
      vysvetleni,
    });
  } catch (err) {
    console.log("CHYBA odesliOdpoved:", err);
    res.status(500).json({ error: "Server error" });
  }
}