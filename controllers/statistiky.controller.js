import { db } from "../config/databaze.js";

/**
 * GET /api/statistiky/ucitel/prehled
 * Přehled pro učitele: souhrn za všechny jeho lekce
 */
export async function ucitelPrehled(req, res) {
  const teacherId = req.user.id;

  // Souhrn: odpovědi na učitelovy lekce
  const [sum] = await db.query(
    `SELECT 
        COUNT(a.id) AS totalAnswers,
        SUM(a.is_correct) AS correctAnswers,
        COUNT(DISTINCT a.student_id) AS uniqueStudents,
        COUNT(DISTINCT l.id) AS lessonsWithActivity
     FROM answers a
     JOIN lessons l ON l.id = a.lesson_id
     WHERE l.created_by = ?`,
    [teacherId]
  );

  const totalAnswers = Number(sum[0]?.totalAnswers || 0);
  const correctAnswers = Number(sum[0]?.correctAnswers || 0);
  const successRate = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  // Nejlepší / nejhorší lekce podle úspěšnosti (min 5 odpovědí)
  const [lessonRates] = await db.query(
    `SELECT
        l.id AS lessonId,
        l.title AS lessonTitle,
        COUNT(a.id) AS total,
        SUM(a.is_correct) AS correct,
        ROUND((SUM(a.is_correct) / COUNT(a.id)) * 100) AS successRate
     FROM answers a
     JOIN lessons l ON l.id = a.lesson_id
     WHERE l.created_by = ?
     GROUP BY l.id, l.title
     HAVING COUNT(a.id) >= 5
     ORDER BY successRate DESC`,
    [teacherId]
  );

  const topLessons = lessonRates.slice(0, 5).map(r => ({
    lessonId: r.lessonId,
    lessonTitle: r.lessonTitle,
    total: Number(r.total),
    correct: Number(r.correct),
    successRate: Number(r.successRate || 0),
  }));

  const bottomLessons = lessonRates.slice(-5).reverse().map(r => ({
    lessonId: r.lessonId,
    lessonTitle: r.lessonTitle,
    total: Number(r.total),
    correct: Number(r.correct),
    successRate: Number(r.successRate || 0),
  }));

  res.json({
    totalAnswers,
    correctAnswers,
    successRate,
    uniqueStudents: Number(sum[0]?.uniqueStudents || 0),
    lessonsWithActivity: Number(sum[0]?.lessonsWithActivity || 0),
    topLessons,
    bottomLessons,
  });
}

/**
 * GET /api/statistiky/ucitel/lekce/:lessonId
 * Detail statistiky jedné lekce (jen pokud je učitel jejím autorem)
 */
export async function ucitelLekceDetail(req, res) {
  const teacherId = req.user.id;
  const { lessonId } = req.params;

  // Ověření vlastnictví lekce
  const [lrows] = await db.query(
    "SELECT id, title FROM lessons WHERE id = ? AND created_by = ?",
    [lessonId, teacherId]
  );
  if (!lrows.length) return res.status(403).json({ error: "K této lekci nemáš přístup." });

  // Souhrn lekce
  const [sum] = await db.query(
    `SELECT 
        COUNT(a.id) AS totalAnswers,
        SUM(a.is_correct) AS correctAnswers,
        COUNT(DISTINCT a.student_id) AS uniqueStudents
     FROM answers a
     WHERE a.lesson_id = ?`,
    [lessonId]
  );

  const totalAnswers = Number(sum[0]?.totalAnswers || 0);
  const correctAnswers = Number(sum[0]?.correctAnswers || 0);
  const successRate = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  // Rozpad podle obtížnosti
  const [byDiff] = await db.query(
    `SELECT 
        q.difficulty AS difficulty,
        COUNT(a.id) AS total,
        SUM(a.is_correct) AS correct
     FROM answers a
     JOIN questions q ON q.id = a.question_id
     WHERE a.lesson_id = ?
     GROUP BY q.difficulty`,
    [lessonId]
  );

  const byDifficulty = byDiff.map(r => ({
    difficulty: r.difficulty,
    total: Number(r.total),
    correct: Number(r.correct),
    successRate: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
  }));

  // Leaderboard studentů (top 20 podle úspěšnosti + min 3 odpovědi)
  const [leader] = await db.query(
    `SELECT
        u.id AS studentId,
        u.name AS studentName,
        COUNT(a.id) AS total,
        SUM(a.is_correct) AS correct,
        ROUND((SUM(a.is_correct) / COUNT(a.id)) * 100) AS successRate
     FROM answers a
     JOIN users u ON u.id = a.student_id
     WHERE a.lesson_id = ?
     GROUP BY u.id, u.name
     HAVING COUNT(a.id) >= 3
     ORDER BY successRate DESC, total DESC
     LIMIT 20`,
    [lessonId]
  );

  // Posledních 30 odpovědí v lekci (audit/monitoring)
  const [recent] = await db.query(
    `SELECT
        a.id,
        a.created_at,
        a.student_id AS studentId,
        u.name AS studentName,
        a.question_id AS questionId,
        q.question AS questionText,
        q.difficulty,
        a.answer AS studentAnswer,
        q.correct AS correctAnswer,
        a.is_correct
     FROM answers a
     JOIN users u ON u.id = a.student_id
     JOIN questions q ON q.id = a.question_id
     WHERE a.lesson_id = ?
     ORDER BY a.created_at DESC
     LIMIT 30`,
    [lessonId]
  );

  res.json({
    lesson: { id: lrows[0].id, title: lrows[0].title },
    totalAnswers,
    correctAnswers,
    successRate,
    uniqueStudents: Number(sum[0]?.uniqueStudents || 0),
    byDifficulty,
    leaderboard: leader.map(r => ({
      studentId: r.studentId,
      studentName: r.studentName,
      total: Number(r.total),
      correct: Number(r.correct),
      successRate: Number(r.successRate || 0),
    })),
    recentAnswers: recent,
  });
}

/**
 * GET /api/statistiky/ucitel/student/:studentId
 * Detail studenta pro učitele — jen v rozsahu učitelových lekcí
 */
export async function ucitelStudentDetail(req, res) {
  const teacherId = req.user.id;
  const { studentId } = req.params;

  // Souhrn odpovědí studenta pouze v lekcích učitele
  const [sum] = await db.query(
    `SELECT
        COUNT(a.id) AS totalAnswers,
        SUM(a.is_correct) AS correctAnswers
     FROM answers a
     JOIN lessons l ON l.id = a.lesson_id
     WHERE a.student_id = ? AND l.created_by = ?`,
    [studentId, teacherId]
  );

  const totalAnswers = Number(sum[0]?.totalAnswers || 0);
  const correctAnswers = Number(sum[0]?.correctAnswers || 0);
  const successRate = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  // Po lekcích učitele
  const [byLesson] = await db.query(
    `SELECT
        l.id AS lessonId,
        l.title AS lessonTitle,
        COUNT(a.id) AS total,
        SUM(a.is_correct) AS correct,
        ROUND((SUM(a.is_correct) / COUNT(a.id)) * 100) AS successRate
     FROM answers a
     JOIN lessons l ON l.id = a.lesson_id
     WHERE a.student_id = ? AND l.created_by = ?
     GROUP BY l.id, l.title
     ORDER BY successRate DESC, total DESC`,
    [studentId, teacherId]
  );

  // Posledních 50 odpovědí studenta v lekcích učitele
  const [recent] = await db.query(
    `SELECT
        a.id,
        a.created_at,
        a.lesson_id AS lessonId,
        l.title AS lessonTitle,
        a.question_id AS questionId,
        q.question AS questionText,
        q.difficulty,
        a.answer AS studentAnswer,
        q.correct AS correctAnswer,
        a.is_correct
     FROM answers a
     JOIN lessons l ON l.id = a.lesson_id
     JOIN questions q ON q.id = a.question_id
     WHERE a.student_id = ? AND l.created_by = ?
     ORDER BY a.created_at DESC
     LIMIT 50`,
    [studentId, teacherId]
  );

  res.json({
    studentId: Number(studentId),
    totalAnswers,
    correctAnswers,
    successRate,
    byLesson: byLesson.map(r => ({
      lessonId: r.lessonId,
      lessonTitle: r.lessonTitle,
      total: Number(r.total),
      correct: Number(r.correct),
      successRate: Number(r.successRate || 0),
    })),
    recentAnswers: recent,
  });
}
