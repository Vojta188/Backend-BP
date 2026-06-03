import { db } from "../config/databaze.js";

export async function seznamStudentuUcitel(req, res) {
  try {
    const q = (req.query.query || "").trim();

    // PŘEDPOKLAD: users má sloupce id, name, email, role
    let sql = "SELECT id, name, email FROM users WHERE role = 'student'";
    const params = [];

    if (q) {
      sql += " AND (name LIKE ? OR email LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += " ORDER BY name LIMIT 200";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.log("CHYBA seznamStudentuUcitel:", e);
    res.status(500).json({ error: "Server error", detail: String(e.message || e) });
  }
}