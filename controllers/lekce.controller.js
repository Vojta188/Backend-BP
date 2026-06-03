import { generujLekci } from "../services/ai.service.js";
import { db } from "../config/databaze.js";



export async function vytvorLekci(req, res) {
const { tema, pocetOtazek } = req.body;
const teacherId = req.user.id;

const data = await generujLekci(tema, pocetOtazek);

if (!data) return res.status(500).json({ error: "AI chyba" });

const [result] = await db.query(
"INSERT INTO lessons (title,content_easy,content_hard,created_by) VALUES (?,?,?,?)",
[tema, data.text_lehky, data.text_tezky, teacherId]
);

const lessonId = result.insertId;

for (const q of data.otazky) {
await db.query(
  `INSERT INTO questions 
  (lesson_id, question, a, b, c, d, correct, explanation, difficulty) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    lessonId,
    q.question,
    q.a,
    q.b,
    q.c,
    q.d,
    q.correct,
    q.explanation,
    q.difficulty
  ]
);

}

res.json({ lessonId });
}


export async function schvalLekci(req, res) {
const lessonId = req.params.id;

await db.query("UPDATE lessons SET approved = true WHERE id = ?", [lessonId]);

res.json({ message: "Lekce schválena" });
}

export async function ziskejLekce(req, res) {
const role = req.user.role;

let rows;

if (role === "teacher") {
[rows] = await db.query("SELECT * FROM lessons");
} else {
const studentId = req.user.id;

 [rows] = await db.query(
  `SELECT l.*,
          COALESCE(la.status,'none') AS attempt_status
   FROM lessons l
   JOIN lesson_targets lt ON lt.lesson_id = l.id AND lt.student_id = ?
   LEFT JOIN lesson_attempts la 
      ON la.lesson_id = l.id AND la.student_id = ? AND la.status = 'active'
   WHERE l.approved = true
   ORDER BY l.id DESC`,
  [studentId, studentId]
);
}

res.json(rows);
}




// GET detail už máš (lesson + questions) – pokud ne, přidej
export async function detailLekce(req, res) {
  const { id } = req.params;

  const [lessons] = await db.query("SELECT * FROM lessons WHERE id = ?", [id]);
  if (!lessons.length) return res.status(404).json({ error: "Lekce nenalezena" });

  const [questions] = await db.query(
    "SELECT * FROM questions WHERE lesson_id = ? ORDER BY id",
    [id]
  );

  res.json({ lesson: lessons[0], questions });
}

// PUT úprava lekce (title + texty), jen učitel a jen vlastní a jen neschválené
export async function upravLekci(req, res) {
  const teacherId = req.user.id;
  const { id } = req.params;
  const { title, content_easy, content_hard } = req.body;

  const [rows] = await db.query(
    "SELECT * FROM lessons WHERE id = ? AND created_by = ?",
    [id, teacherId]
  );
  if (!rows.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });
  if (rows[0].approved) return res.status(400).json({ error: "Schválenou lekci nelze upravit." });

  await db.query(
    "UPDATE lessons SET title = ?, content_easy = ?, content_hard = ? WHERE id = ?",
    [title, content_easy, content_hard, id]
  );

  res.json({ message: "Lekce upravena" });
}


export async function nastavCiloveZakys(req, res) {
  const teacherId = req.user.id;
  const { id } = req.params; // lessonId
  const { studentIds } = req.body;

  // ověř, že lekce patří učiteli
  const [lrows] = await db.query("SELECT id FROM lessons WHERE id = ? AND created_by = ?", [id, teacherId]);
  if (!lrows.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

  // smažeme staré cíle a uložíme nové
  await db.query("DELETE FROM lesson_targets WHERE lesson_id = ?", [id]);

  if (Array.isArray(studentIds) && studentIds.length) {
    for (const sid of studentIds) {
      await db.query("INSERT INTO lesson_targets (lesson_id, student_id) VALUES (?,?)", [id, sid]);
    }
  }

  res.json({ message: "Přiřazení uloženo" });
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

  // smažeme (schválení nehraje roli)
  await db.query("DELETE FROM lessons WHERE id = ?", [id]);

  res.json({ message: "Lekce smazána" });
}


export async function ziskejPrirazeni(req, res) {
  try {
    const teacherId = req.user.id;
    const { id } = req.params; // lessonId

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

export async function nastavCiloveZaky(req, res) {
  try {
    const teacherId = req.user.id;
    const { id } = req.params; // lessonId
    const { studentIds } = req.body;

    const [lrows] = await db.query(
      "SELECT id FROM lessons WHERE id = ? AND created_by = ?",
      [id, teacherId]
    );
    if (!lrows.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

    await db.query("DELETE FROM lesson_targets WHERE lesson_id = ?", [id]);

    if (Array.isArray(studentIds) && studentIds.length) {
      for (const sid of studentIds) {
        await db.query(
          "INSERT INTO lesson_targets (lesson_id, student_id) VALUES (?,?)",
          [id, sid]
        );
      }
    }

    res.json({ message: "Přiřazení uloženo" });
  } catch (e) {
    console.log("CHYBA nastavCiloveZaky:", e);
    res.status(500).json({ error: "Server error" });
  }
}

export async function prehledZakuLekce(req, res) {
  try {
    const teacherId = req.user.id;
    const { id } = req.params; // lessonId

    // ověř vlastnictví lekce
    const [l] = await db.query("SELECT id FROM lessons WHERE id = ? AND created_by = ?", [id, teacherId]);
    if (!l.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

    // seznam přiřazených žáků + jejich poslední stav attemptu
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
      if (completed) status = "splneno"; // splněno má přednost

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
  try {
    const teacherId = req.user.id;
    const { id } = req.params; // lessonId
    const { studentIds } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: "Chybí studentIds" });
    }

    const [l] = await db.query("SELECT id FROM lessons WHERE id = ? AND created_by = ?", [id, teacherId]);
    if (!l.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

    for (const sid of studentIds) {
      try {
        await db.query(
          "INSERT INTO lesson_targets (lesson_id, student_id) VALUES (?,?)",
          [id, sid]
        );
      } catch {
        // už existuje -> ignorujeme
      }
    }

    res.json({ message: "Žáci přidáni k lekci" });
  } catch (e) {
    console.log("CHYBA pridejZakyDoLekce:", e);
    res.status(500).json({ error: "Server error" });
  }
}