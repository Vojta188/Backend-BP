import { db } from "../config/databaze.js";

export async function povolOpakovani(req, res) {
  const teacherId = req.user.id;
  const { lessonId, studentId } = req.body;

  // ověř vlastnictví lekce
  const [l] = await db.query("SELECT id FROM lessons WHERE id = ? AND created_by = ?", [lessonId, teacherId]);
  if (!l.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

  // smaž completed attempt (nebo je můžeš archivovat – pro jednoduchost mažeme jen status)
  await db.query(
    "DELETE FROM lesson_attempts WHERE lesson_id = ? AND student_id = ? AND status='completed'",
    [lessonId, studentId]
  );

  res.json({ message: "Opakování povoleno" });
}

export async function povolOpakovaniHromadne(req, res) {
  try {
    const teacherId = req.user.id;
    const { lessonId, studentIds } = req.body;

    if (!lessonId || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: "Chybí lessonId nebo studentIds" });
    }

    // ověř vlastnictví lekce
    const [l] = await db.query("SELECT id FROM lessons WHERE id = ? AND created_by = ?", [lessonId, teacherId]);
    if (!l.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

    // smažeme completed attempty (tím se lekce “odemkne”)
    // (můžeš místo DELETE dělat UPDATE -> archived, ale DELETE je nejjednodušší)
    const placeholders = studentIds.map(() => "?").join(",");
    await db.query(
      `DELETE FROM lesson_attempts 
       WHERE lesson_id = ? AND status='completed' AND student_id IN (${placeholders})`,
      [lessonId, ...studentIds]
    );

    res.json({ message: "Opakování povoleno vybraným žákům" });
  } catch (e) {
    console.log("CHYBA povolOpakovaniHromadne:", e);
    res.status(500).json({ error: "Server error" });
  }
}