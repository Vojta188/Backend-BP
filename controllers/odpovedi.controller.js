import { db } from "../config/databaze.js";
import { generujVysvetleni } from "../services/vysvetleni.service.js";

export async function odesliOdpoved(req, res) {
  let conn;
  try {
    const studentId = req.user.id;
    const { questionId, answer } = req.body ?? {};
    const studentAns = typeof answer === "string" ? answer.trim().toUpperCase() : "";
    if (!Number.isSafeInteger(Number(questionId)) || Number(questionId) <= 0 ||
        !["A", "B", "C", "D"].includes(studentAns)) {
      return res.status(400).json({ error: "Neplatná otázka nebo odpověď." });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT id, lesson_id, question, a, b, c, d, correct FROM questions WHERE id = ?", [questionId]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Otázka neexistuje." });
    }
    const q = rows[0];

    const [att] = await conn.query(
      `SELECT la.id FROM lesson_attempts la
       JOIN lesson_targets lt ON lt.lesson_id = la.lesson_id AND lt.student_id = la.student_id
       JOIN lessons l ON l.id = la.lesson_id
       WHERE la.lesson_id = ? AND la.student_id = ? AND la.status = 'active'
         AND l.approved = true LIMIT 1 FOR UPDATE`,
      [q.lesson_id, studentId]
    );
    if (!att.length) {
      await conn.rollback();
      return res.status(403).json({ error: "Pro tuto otázku nemáš aktivní test." });
    }

    const attemptId = att[0].id;
    const jeSpravne = String(q.correct || "").trim().toUpperCase() === studentAns;
    // Odpověď se uloží i při nedostupnosti AI; unikátní index zabraňuje souběžné duplicitě.
    let inserted;
    try {
      [inserted] = await conn.query(
        `INSERT INTO answers (student_id, question_id, lesson_id, attempt_id, answer, is_correct)
         VALUES (?,?,?,?,?,?)`,
        [studentId, q.id, q.lesson_id, attemptId, studentAns, jeSpravne]
      );
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        await conn.rollback();
        return res.status(409).json({ error: "Na tuto otázku už jsi odpověděl." });
      }
      throw error;
    }
    await conn.commit();
    conn.release();
    conn = null;

    let vysvetleni = null;
    if (!jeSpravne) {
      try {
        vysvetleni = await generujVysvetleni(
          q.question, q[q.correct.toLowerCase()], q[studentAns.toLowerCase()]
        );
        if (vysvetleni) {
          await db.query("UPDATE answers SET explanation = ? WHERE id = ?", [vysvetleni, inserted.insertId]);
        }
      } catch (error) {
        console.error("Vysvětlení odpovědi není dostupné:", error);
      }
    }
    return res.json({ answerId: inserted.insertId, correct: jeSpravne, vysvetleni });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("Uložení odpovědi selhalo:", error);
    return res.status(500).json({ error: "Odpověď se nepodařilo uložit." });
  } finally {
    if (conn) conn.release();
  }
}
