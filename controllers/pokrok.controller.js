import { db } from "../config/databaze.js";

export async function ziskejPokrok(req, res) {
const studentId = req.user.id;

const [rows] = await db.query(
"SELECT COUNT(*) as total, SUM(is_correct) as correct FROM answers WHERE student_id = ?",
[studentId]
);

const total = rows[0].total || 0;
const correct = rows[0].correct || 0;

let procenta = 0;
if (total > 0) procenta = (correct / total) * 100;

res.json({
total,
correct,
procenta,
});
}
