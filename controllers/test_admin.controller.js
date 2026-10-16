import { db } from "../config/databaze.js";

export async function povolOpakovani(req, res) {
  const teacherId = req.user.id;
  const { lessonId, studentId } = req.body ?? {};

  const [l] = await db.query("SELECT id FROM lessons WHERE id = ? AND created_by = ?", [lessonId, teacherId]);
  if (!l.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

  if (!Number.isSafeInteger(Number(studentId)) || Number(studentId) <= 0) {
    return res.status(400).json({ error: "Neplatný studentId." });
  }

  // Starý pokus i jeho odpovědi zůstávají zachovány.
  await db.query(
    "UPDATE lesson_attempts SET status='archived' WHERE lesson_id = ? AND student_id = ? AND status='completed'",
    [lessonId, studentId]
  );

  res.json({ message: "Opakování povoleno" });
}

export async function povolOpakovaniHromadne(req, res) {
  try {
    const teacherId = req.user.id;
    const { lessonId, studentIds } = req.body ?? {};

    if (!lessonId || !Array.isArray(studentIds) || studentIds.length === 0 ||
        studentIds.length > 200 ||
        studentIds.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) {
      return res.status(400).json({ error: "Chybí lessonId nebo studentIds" });
    }

    const [l] = await db.query("SELECT id FROM lessons WHERE id = ? AND created_by = ?", [lessonId, teacherId]);
    if (!l.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

    const placeholders = studentIds.map(() => "?").join(",");
    await db.query(
      `UPDATE lesson_attempts SET status='archived'
       WHERE lesson_id = ? AND status='completed' AND student_id IN (${placeholders})`,
      [lessonId, ...studentIds]
    );

    res.json({ message: "Opakování povoleno vybraným žákům" });
  } catch (e) {
    console.log("CHYBA povolOpakovaniHromadne:", e);
    res.status(500).json({ error: "Server error" });
  }
}
