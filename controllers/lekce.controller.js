import { generujLekci } from "../services/ai.service.js";
import { db } from "../config/databaze.js";
import { promichejOdpovedi } from "../utils/promichejOdpovedi.js";



export async function vytvorLekci(req, res) {
  const { tema, pocetOtazek } = req.body ?? {};
  const title = typeof tema === "string" ? tema.trim() : "";
  const count = Number(pocetOtazek);
  if (title.length < 3 || title.length > 200 || !Number.isInteger(count) || count < 1 || count > 30) {
    return res.status(400).json({ error: "Zadej téma (3–200 znaků) a 1–30 otázek." });
  }

  try {
    const data = await generujLekci(title, count);
    const questions = data?.otazky;
    if (!Array.isArray(questions) || questions.length !== count ||
        typeof data.text_lehky !== "string" || data.text_lehky.length > 65000 ||
        typeof data.text_tezky !== "string" || data.text_tezky.length > 65000 ||
        questions.some((q) => !q || !["A", "B", "C", "D"].includes(q.correct) ||
          !["easy", "hard"].includes(q.difficulty) ||
          [q.question, q.a, q.b, q.c, q.d].some((value) => typeof value !== "string" ||
            !value.trim() || value.length > 65000) ||
          (q.explanation != null && (typeof q.explanation !== "string" || q.explanation.length > 65000)))) {
      return res.status(502).json({ error: "AI nevrátila úplnou lekci. Zkus to znovu." });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        "INSERT INTO lessons (title,content_easy,content_hard,created_by) VALUES (?,?,?,?)",
        [title, data.text_lehky, data.text_tezky, req.user.id]
      );
      for (const question of questions) {
        // Zapamatujeme si původně správný text.
        const spravnyText = question[question.correct.toLowerCase()];

        const q = promichejOdpovedi(question);

        // Správné písmeno určíme podle nové pozice tohoto textu.
        const shody = ["A", "B", "C", "D"].filter(
          (pismeno) => q[pismeno.toLowerCase()] === spravnyText
        );

if (shody.length !== 1) {
  throw new Error("Správnou odpověď nelze jednoznačně přiřadit.");
}

q.correct = shody[0];
        await conn.query(
          `INSERT INTO questions
           (lesson_id, question, a, b, c, d, correct, explanation, difficulty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [result.insertId, q.question, q.a, q.b, q.c, q.d, q.correct, q.explanation || "", q.difficulty]
        );
      }
      await conn.commit();
      return res.json({ lessonId: result.insertId });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Vytvoření lekce selhalo:", error);
    return res.status(500).json({ error: "Lekci se nepodařilo uložit." });
  }
}


export async function schvalLekci(req, res) {
  const [result] = await db.query(
    "UPDATE lessons SET approved = true WHERE id = ? AND created_by = ?",
    [req.params.id, req.user.id]
  );
  if (!result.affectedRows) return res.status(403).json({ error: "K této lekci nemáš přístup." });
  return res.json({ message: "Lekce schválena" });
}

export async function ziskejLekce(req, res) {
const role = req.user.role;

let rows;

if (role === "teacher" || role === "admin") {
[rows] = await db.query("SELECT * FROM lessons WHERE created_by = ? ORDER BY id DESC", [req.user.id]);
} else {
const studentId = req.user.id;

 [rows] = await db.query(
  `SELECT l.*,
          CASE WHEN EXISTS (
            SELECT 1 FROM lesson_attempts la
            WHERE la.lesson_id = l.id AND la.student_id = ? AND la.status = 'completed'
          ) THEN 'completed' WHEN EXISTS (
            SELECT 1 FROM lesson_attempts la
            WHERE la.lesson_id = l.id AND la.student_id = ? AND la.status = 'active'
          ) THEN 'active' ELSE 'none' END AS attempt_status
   FROM lessons l
   JOIN lesson_targets lt ON lt.lesson_id = l.id AND lt.student_id = ?
   WHERE l.approved = true
   ORDER BY l.id DESC`,
  [studentId, studentId, studentId]
);
}

res.json(rows);
}




export async function detailLekce(req, res) {
  const { id } = req.params;
  const [lessons] = await db.query("SELECT * FROM lessons WHERE id = ?", [id]);
  if (!lessons.length) return res.status(404).json({ error: "Lekce nenalezena" });

  const lesson = lessons[0];
  const teacher = req.user.role === "teacher" || req.user.role === "admin";
  if (teacher && lesson.created_by !== req.user.id) {
    return res.status(403).json({ error: "K této lekci nemáš přístup." });
  }
  if (!teacher) {
    if (req.user.role !== "student" || !lesson.approved) {
      return res.status(403).json({ error: "K této lekci nemáš přístup." });
    }
    const [allowed] = await db.query(
      "SELECT 1 FROM lesson_targets WHERE lesson_id = ? AND student_id = ? LIMIT 1",
      [id, req.user.id]
    );
    if (!allowed.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });
  }

  const [questions] = await db.query(
    teacher
      ? "SELECT * FROM questions WHERE lesson_id = ? ORDER BY id"
      : "SELECT id, lesson_id, question, a, b, c, d, difficulty FROM questions WHERE lesson_id = ? ORDER BY id",
    [id]
  );

  res.json({ lesson, questions });
}

// PUT úprava lekce (title + texty), jen učitel a jen vlastní a jen neschválené
export async function upravLekci(req, res) {
  const teacherId = req.user.id;
  const { id } = req.params;
  const { title, content_easy, content_hard } = req.body;
  if (typeof title !== "string" || title.trim().length < 3 || title.length > 255 ||
      typeof content_easy !== "string" || typeof content_hard !== "string" ||
      content_easy.length > 65000 || content_hard.length > 65000) {
    return res.status(400).json({ error: "Neplatný název nebo obsah lekce." });
  }

  const [rows] = await db.query(
    "SELECT * FROM lessons WHERE id = ? AND created_by = ?",
    [id, teacherId]
  );
  if (!rows.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });
  if (rows[0].approved) return res.status(400).json({ error: "Schválenou lekci nelze upravit." });

  await db.query(
    "UPDATE lessons SET title = ?, content_easy = ?, content_hard = ? WHERE id = ?",
    [title.trim(), content_easy, content_hard, id]
  );

  res.json({ message: "Lekce upravena" });
}


export async function smazLekci(req, res) {
  const teacherId = req.user.id;
  const { id } = req.params;

  // jen vlastník lekce
  const [rows] = await db.query(
    "SELECT id, approved FROM lessons WHERE id = ? AND created_by = ?",
    [id, teacherId]
  );
  if (!rows.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

  const [activity] = await db.query("SELECT 1 FROM answers WHERE lesson_id = ? LIMIT 1", [id]);
  if (activity.length) return res.status(409).json({ error: "Lekci s uloženými výsledky nelze smazat." });

  await db.query("DELETE FROM lessons WHERE id = ?", [id]);

  res.json({ message: "Lekce smazána" });
}


export async function ziskejPrirazeni(req, res) {
  try {
    const teacherId = req.user.id;
    const { id } = req.params; 

    const [lrows] = await db.query(
      "SELECT id FROM lessons WHERE id = ? AND created_by = ?",
      [id, teacherId]
    );
    if (!lrows.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

    const [rows] = await db.query(
      "SELECT student_id FROM lesson_targets WHERE lesson_id = ?",
      [id]
    );

    res.json({ studentIds: rows.map(r => r.student_id) });
  } catch (e) {
    console.log("CHYBA ziskejPrirazeni:", e);
    res.status(500).json({ error: "Server error" });
  }
}

function pripravStudentIds(ids, allowEmpty = true) {
  if (!Array.isArray(ids) || ids.length > 200 || (!allowEmpty && ids.length === 0) ||
      ids.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) return null;
  return [...new Set(ids.map(Number))];
}

async function overStudenty(conn, ids) {
  if (ids.length === 0) return true;
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await conn.query(
    `SELECT id FROM users WHERE role = 'student' AND id IN (${placeholders})`, ids
  );
  return rows.length === ids.length;
}

export async function nastavCiloveZaky(req, res) {
  const { id } = req.params;
  const studentIds = pripravStudentIds(req.body?.studentIds);
  if (!studentIds) return res.status(400).json({ error: "Neplatný seznam žáků." });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [lrows] = await conn.query(
      "SELECT id FROM lessons WHERE id = ? AND created_by = ? FOR UPDATE",
      [id, req.user.id]
    );
    if (!lrows.length || !(await overStudenty(conn, studentIds))) {
      await conn.rollback();
      return res.status(!lrows.length ? 403 : 400).json({ error: !lrows.length
        ? "K této lekci nemáš přístup." : "Seznam obsahuje neplatného žáka." });
    }
    await conn.query("DELETE FROM lesson_targets WHERE lesson_id = ?", [id]);
    for (const sid of studentIds) {
      await conn.query("INSERT INTO lesson_targets (lesson_id, student_id) VALUES (?,?)", [id, sid]);
    }
    await conn.commit();
    return res.json({ message: "Přiřazení uloženo" });
  } catch (e) {
    await conn.rollback();
    console.error("CHYBA nastavCiloveZaky:", e);
    return res.status(500).json({ error: "Přiřazení se nepodařilo uložit." });
  } finally {
    conn.release();
  }
}

export async function prehledZakuLekce(req, res) {
  try {
    const teacherId = req.user.id;
    const { id } = req.params; 

    const [l] = await db.query("SELECT id FROM lessons WHERE id = ? AND created_by = ?", [id, teacherId]);
    if (!l.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

    const [rows] = await db.query(
      `
      SELECT 
        u.id AS student_id,
        u.name,
        u.email,
        -- completed attempt existuje?
        (SELECT COUNT(*) FROM lesson_attempts la 
          WHERE la.lesson_id = ? AND la.student_id = u.id AND la.status='completed') AS completed_count,
        -- active attempt existuje?
        (SELECT COUNT(*) FROM lesson_attempts la 
          WHERE la.lesson_id = ? AND la.student_id = u.id AND la.status='active') AS active_count,
        -- poslední completed datum (pokud je)
        (SELECT MAX(la.completed_at) FROM lesson_attempts la
          WHERE la.lesson_id = ? AND la.student_id = u.id AND la.status='completed') AS last_completed_at
      FROM lesson_targets lt
      JOIN users u ON u.id = lt.student_id
      WHERE lt.lesson_id = ?
      ORDER BY u.name
      `,
      [id, id, id, id]
    );

    const mapped = rows.map(r => {
      const completed = Number(r.completed_count || 0) > 0;
      const active = Number(r.active_count || 0) > 0;

      let status = "nezacato";
      if (active) status = "rozpracovano";
      if (completed) status = "splneno"; 

      return {
        student_id: r.student_id,
        name: r.name,
        email: r.email,
        status,
        last_completed_at: r.last_completed_at,
      };
    });

    res.json(mapped);
  } catch (e) {
    console.log("CHYBA prehledZakuLekce:", e);
    res.status(500).json({ error: "Server error" });
  }
}

export async function pridejZakyDoLekce(req, res) {
  const studentIds = pripravStudentIds(req.body?.studentIds, false);
  if (!studentIds) return res.status(400).json({ error: "Neplatný seznam žáků." });
  try {
    const teacherId = req.user.id;
    const { id } = req.params; 

    const [l] = await db.query("SELECT id FROM lessons WHERE id = ? AND created_by = ?", [id, teacherId]);
    if (!l.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });
    if (!(await overStudenty(db, studentIds))) {
      return res.status(400).json({ error: "Seznam obsahuje neplatného žáka." });
    }

    for (const sid of studentIds) {
      await db.query(
        "INSERT INTO lesson_targets (lesson_id, student_id) VALUES (?,?) ON DUPLICATE KEY UPDATE id = id",
        [id, sid]
      );
    }

    res.json({ message: "Žáci přidáni k lekci" });
  } catch (e) {
    console.log("CHYBA pridejZakyDoLekce:", e);
    res.status(500).json({ error: "Server error" });
  }
}
