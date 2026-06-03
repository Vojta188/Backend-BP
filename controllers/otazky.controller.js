import { db } from "../config/databaze.js";

export async function ziskejOtazky(req, res) {
  const { lessonId } = req.params;
  const studentId = req.user.id;

  // spočítáme úspěšnost studenta
  const [stats] = await db.query(
    "SELECT COUNT(*) AS total, SUM(is_correct) AS correct FROM answers WHERE student_id = ?",
    [studentId]
  );

  const total = stats[0].total || 0;
  const correct = stats[0].correct || 0;

  let difficulty = "easy";

  if (total > 0) {
    const successRate = correct / total;

    if (successRate >= 0.7) difficulty = "hard";
    else difficulty = "easy";
  }

  // vyber otázky podle obtížnosti
  const [questions] = await db.query(
    "SELECT * FROM questions WHERE lesson_id = ? AND difficulty = ?",
    [lessonId, difficulty]
  );

  res.json(questions);
}



// PUT /api/otazky/:id (jen učitel, jen vlastní lekce, jen neschválená)
export async function upravOtazku(req, res) {
  const teacherId = req.user.id;
  const { id } = req.params;
  const { question, a, b, c, d, correct, explanation, difficulty } = req.body;

  const [rows] = await db.query(
    `SELECT q.id, q.lesson_id, l.created_by, l.approved
     FROM questions q
     JOIN lessons l ON l.id = q.lesson_id
     WHERE q.id = ?`,
    [id]
  );

  if (!rows.length) return res.status(404).json({ error: "Otázka neexistuje" });
  if (rows[0].created_by !== teacherId) return res.status(403).json({ error: "K této otázce nemáš přístup." });
  if (rows[0].approved) return res.status(400).json({ error: "Schválenou lekci nelze upravit." });

  await db.query(
    `UPDATE questions SET
      question = ?, a = ?, b = ?, c = ?, d = ?,
      correct = ?, explanation = ?, difficulty = ?
     WHERE id = ?`,
    [question, a, b, c, d, correct, explanation, difficulty, id]
  );

  res.json({ message: "Otázka upravena" });
}

// DELETE /api/otazky/:id (jen učitel, jen vlastní lekce, jen neschválená)
export async function smazOtazku(req, res) {
  const teacherId = req.user.id;
  const { id } = req.params;

  const [rows] = await db.query(
    `SELECT q.id, l.created_by, l.approved
     FROM questions q
     JOIN lessons l ON l.id = q.lesson_id
     WHERE q.id = ?`,
    [id]
  );

  if (!rows.length) return res.status(404).json({ error: "Otázka neexistuje" });
  if (rows[0].created_by !== teacherId) return res.status(403).json({ error: "K této otázce nemáš přístup." });
  if (rows[0].approved) return res.status(400).json({ error: "Schválenou lekci nelze upravit." });

  await db.query("DELETE FROM questions WHERE id = ?", [id]);
  res.json({ message: "Otázka smazána" });
}
