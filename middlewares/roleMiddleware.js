export function jenUcitel(req, res, next) {
if (req.user.role !== "teacher" && req.user.role !== "admin") {
return res.status(403).json({ error: "Jen učitel" });
}
next();
}

export function jenStudent(req, res, next) {
if (req.user.role !== "student") {
return res.status(403).json({ error: "Jen student" });
}
next();
}
