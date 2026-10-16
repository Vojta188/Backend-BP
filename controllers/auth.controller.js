import bcrypt from "bcrypt";
import { createHash, timingSafeEqual } from "node:crypto";
import { najdiUzivateleEmail, vytvorUzivatele } from "../models/user.model.js";
import { vytvorToken } from "../config/jwt.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function platnaPozvanka(value) {
  const expected = process.env.TEACHER_INVITE_CODE;
  if (!expected || expected.length < 16 || typeof value !== "string") return false;
  const a = createHash("sha256").update(value).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function registrace(req, res) {
  try {
    const { name, email, password, role = "student", inviteCode } = req.body ?? {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanName || cleanName.length > 100 || !emailPattern.test(cleanEmail) ||
        cleanEmail.length > 100 || typeof password !== "string" ||
        password.length < 8 || password.length > 128 ||
        !["student", "teacher"].includes(role)) {
      return res.status(400).json({ error: "Zkontroluj jméno, e-mail, heslo (min. 8 znaků) a roli." });
    }
    if (role === "teacher" && !platnaPozvanka(inviteCode)) {
      return res.status(403).json({ error: "Pro registraci učitele je nutný platný pozvánkový kód." });
    }

    const hash = await bcrypt.hash(password, 10);
    await vytvorUzivatele({ name: cleanName, email: cleanEmail, password: hash, role });
    return res.status(201).json({ message: "Registrace OK" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Tento e-mail je už registrován." });
    }
    console.error("Registrace selhala:", error);
    return res.status(500).json({ error: "Registrace se nezdařila." });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" ||
        email.length > 100 || password.length > 128) {
      return res.status(400).json({ error: "Zadej platný e-mail a heslo." });
    }

    const user = await najdiUzivateleEmail(email.trim().toLowerCase());
    const ok = user ? await bcrypt.compare(password, user.password) : false;
    if (!ok) return res.status(401).json({ error: "Nesprávný e-mail nebo heslo." });

    const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    return res.json({ token: vytvorToken(user), user: publicUser });
  } catch (error) {
    console.error("Přihlášení selhalo:", error);
    return res.status(500).json({ error: "Přihlášení se nezdařilo." });
  }
}
