import { db } from "../config/databaze.js";

// Student otevře lekci → vytvoří se nebo se vrátí aktivní attempt
export async function startAttempt(req, res) {
  const studentId = req.user.id;
  const { lessonId } = req.params;

  // musí být přiřazený
  const [allowed] = await db.query(
    "SELECT 1 FROM lesson_targets WHERE lesson_id = ? AND student_id = ? LIMIT 1",
    [lessonId, studentId]
  );
  if (!allowed.length) return res.status(403).json({ error: "Lekce není pro tebe." });

  // pokud už existuje completed attempt, zamezíme start dokud učitel nerestartuje
  const [completed] = await db.query(
    "SELECT id FROM lesson_attempts WHERE lesson_id = ? AND student_id = ? AND status = 'completed' LIMIT 1",
    [lessonId, studentId]
  );
  if (completed.length) return res.status(403).json({ error: "Lekce je splněná. Čekej, až učitel povolí opakování." });

  // aktivní attempt
  const [active] = await db.query(
    "SELECT * FROM lesson_attempts WHERE lesson_id = ? AND student_id = ? AND status = 'active' LIMIT 1",
    [lessonId, studentId]
  );
  if (active.length) return res.json({ attemptId: active[0].id });

  // nový attempt_no
  const [maxRow] = await db.query(
    "SELECT COALESCE(MAX(attempt_no),0) AS mx FROM lesson_attempts WHERE lesson_id = ? AND student_id = ?",
    [lessonId, studentId]
  );
  const attemptNo = Number(maxRow[0].mx || 0) + 1;

  const [ins] = await db.query(
    "INSERT INTO lesson_attempts (lesson_id, student_id, attempt_no, status) VALUES (?,?,?, 'active')",
    [lessonId, studentId, attemptNo]
  );

  res.json({ attemptId: ins.insertId });
}

// Vrátí další otázku podle průběžné úspěšnosti (adaptivně)
export async function nextQuestion(req, res) {
  const studentId = req.user.id;
  const { lessonId } = req.params;

  const [att] = await db.query(
    "SELECT * FROM lesson_attempts WHERE lesson_id = ? AND student_id = ? AND status='active' LIMIT 1",
    [lessonId, studentId]
  );
  if (!att.length) return res.status(400).json({ error: "Nejdřív spusť pokus." });

  const attemptId = att[0].id;

  // spočítej úspěšnost v TOMTO attemptu
  const [stats] = await db.query(
    "SELECT COUNT(*) AS total, SUM(is_correct) AS correct FROM answers WHERE attempt_id = ?",
    [attemptId]
  );
  const total = Number(stats[0].total || 0);
  const correct = Number(stats[0].correct || 0);
  const rate = total ? correct / total : 0;

  // adaptace: pokud >= 70% → hard, jinak easy
  const difficulty = rate >= 0.7 ? "hard" : "easy";

  // vezmi ještě nezodpovězenou otázku preferované obtížnosti
  const [q] = await db.query(
    `SELECT * FROM questions 
     WHERE lesson_id = ? 
       AND difficulty = ?
       AND id NOT IN (SELECT question_id FROM answers WHERE attempt_id = ?)
     ORDER BY RAND()
     LIMIT 1`,
    [lessonId, difficulty, attemptId]
  );

  // když už nejsou otázky dané obtížnosti, zkus jakoukoliv
  if (!q.length) {
    const [any] = await db.query(
      `SELECT * FROM questions 
       WHERE lesson_id = ?
         AND id NOT IN (SELECT question_id FROM answers WHERE attempt_id = ?)
       ORDER BY RAND()
       LIMIT 1`,
      [lessonId, attemptId]
    );

    if (!any.length) {
      return res.json({ done: true, attemptId, difficulty, question: null });
    }
    return res.json({ done: false, attemptId, difficulty, question: any[0] });
  }

  res.json({ done: false, attemptId, difficulty, question: q[0] });
}

// Dokončení testu (když už není další otázka)
export async function finishAttempt(req, res) {
  const studentId = req.user.id;
  const { lessonId } = req.params;

  const [att] = await db.query(
    "SELECT * FROM lesson_attempts WHERE lesson_id = ? AND student_id = ? AND status='active' LIMIT 1",
    [lessonId, studentId]
  );
  if (!att.length) return res.status(400).json({ error: "Neexistuje aktivní pokus." });

  const attemptId = att[0].id;

  await db.query(
    "UPDATE lesson_attempts SET status='completed', completed_at=NOW() WHERE id = ?",
    [attemptId]
  );

  res.json({ message: "Lekce splněna", attemptId });
}