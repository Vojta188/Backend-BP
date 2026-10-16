import { db } from "../config/databaze.js";

export async function startAttempt(req, res) {
  const studentId = req.user.id;
  const { lessonId } = req.params;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [allowed] = await conn.query(
      `SELECT lt.id FROM lesson_targets lt JOIN lessons l ON l.id = lt.lesson_id
       WHERE lt.lesson_id = ? AND lt.student_id = ? AND l.approved = true
       FOR UPDATE`,
      [lessonId, studentId]
    );
    if (!allowed.length) {
      await conn.rollback();
      return res.status(403).json({ error: "Lekce není schválená nebo ti není přiřazena." });
    }

    const [completed] = await conn.query(
      "SELECT id FROM lesson_attempts WHERE lesson_id = ? AND student_id = ? AND status = 'completed' LIMIT 1",
      [lessonId, studentId]
    );
    if (completed.length) {
      await conn.rollback();
      return res.status(403).json({ error: "Lekce je splněná. Čekej, až učitel povolí opakování." });
    }

    const [active] = await conn.query(
      "SELECT id FROM lesson_attempts WHERE lesson_id = ? AND student_id = ? AND status = 'active' LIMIT 1",
      [lessonId, studentId]
    );
    if (active.length) {
      await conn.commit();
      return res.json({ attemptId: active[0].id });
    }

    const [maxRow] = await conn.query(
      "SELECT COALESCE(MAX(attempt_no),0) AS mx FROM lesson_attempts WHERE lesson_id = ? AND student_id = ?",
      [lessonId, studentId]
    );
    const attemptNo = Number(maxRow[0].mx) + 1;
    const [inserted] = await conn.query(
      "INSERT INTO lesson_attempts (lesson_id, student_id, attempt_no, status) VALUES (?,?,?, 'active')",
      [lessonId, studentId, attemptNo]
    );
    await conn.commit();
    return res.json({ attemptId: inserted.insertId });
  } catch (error) {
    await conn.rollback();
    console.error("Spuštění testu selhalo:", error);
    return res.status(500).json({ error: "Test se nepodařilo spustit." });
  } finally {
    conn.release();
  }
}

const visibleFields = "id, lesson_id, question, a, b, c, d, difficulty";

export async function nextQuestion(req, res) {
  const studentId = req.user.id;
  const { lessonId } = req.params;
  const [att] = await db.query(
    `SELECT la.id FROM lesson_attempts la
     JOIN lesson_targets lt ON lt.lesson_id = la.lesson_id AND lt.student_id = la.student_id
     JOIN lessons l ON l.id = la.lesson_id
     WHERE la.lesson_id = ? AND la.student_id = ? AND la.status='active'
       AND l.approved = true LIMIT 1`,
    [lessonId, studentId]
  );
  if (!att.length) return res.status(400).json({ error: "Nejdřív spusť pokus." });

  const attemptId = att[0].id;
  const [stats] = await db.query(
    "SELECT COUNT(*) AS total, COALESCE(SUM(is_correct), 0) AS correct FROM answers WHERE attempt_id = ?",
    [attemptId]
  );
  const total = Number(stats[0].total);
  const rate = total ? Number(stats[0].correct) / total : 0;
  const difficulty = rate >= 0.7 ? "hard" : "easy";
  const [questionCount] = await db.query(
    "SELECT COUNT(*) AS totalQuestions FROM questions WHERE lesson_id = ?",
    [lessonId]
  );
  const progress = {
    answered: total,
    correct: Number(stats[0].correct),
    totalQuestions: Number(questionCount[0].totalQuestions),
  };

  const [preferred] = await db.query(
    `SELECT ${visibleFields} FROM questions
     WHERE lesson_id = ? AND difficulty = ?
       AND id NOT IN (SELECT question_id FROM answers WHERE attempt_id = ?)
     ORDER BY RAND() LIMIT 1`,
    [lessonId, difficulty, attemptId]
  );
  if (preferred.length) {
    return res.json({ done: false, attemptId, difficulty, progress, question: preferred[0] });
  }

  const [any] = await db.query(
    `SELECT ${visibleFields} FROM questions
     WHERE lesson_id = ?
       AND id NOT IN (SELECT question_id FROM answers WHERE attempt_id = ?)
     ORDER BY RAND() LIMIT 1`,
    [lessonId, attemptId]
  );
  return res.json({ done: !any.length, attemptId, difficulty, progress, question: any[0] || null });
}

export async function finishAttempt(req, res) {
  const studentId = req.user.id;
  const { lessonId } = req.params;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [att] = await conn.query(
      "SELECT id FROM lesson_attempts WHERE lesson_id = ? AND student_id = ? AND status='active' LIMIT 1 FOR UPDATE",
      [lessonId, studentId]
    );
    if (!att.length) {
      await conn.rollback();
      return res.status(400).json({ error: "Neexistuje aktivní pokus." });
    }
    const attemptId = att[0].id;
    const [missing] = await conn.query(
      `SELECT COUNT(*) AS remaining FROM questions q
       WHERE q.lesson_id = ? AND NOT EXISTS
         (SELECT 1 FROM answers a WHERE a.question_id = q.id AND a.attempt_id = ?)`,
      [lessonId, attemptId]
    );
    if (Number(missing[0].remaining) > 0) {
      await conn.rollback();
      return res.status(400).json({ error: "Nejdřív odpověz na všechny otázky." });
    }
    await conn.query(
      "UPDATE lesson_attempts SET status='completed', completed_at=NOW() WHERE id = ? AND status='active'",
      [attemptId]
    );
    await conn.commit();
    return res.json({ message: "Lekce splněna", attemptId });
  } catch (error) {
    await conn.rollback();
    console.error("Dokončení testu selhalo:", error);
    return res.status(500).json({ error: "Test se nepodařilo dokončit." });
  } finally {
    conn.release();
  }
}
