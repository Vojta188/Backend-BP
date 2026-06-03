import bcrypt from "bcrypt";
import { najdiUzivateleEmail, vytvorUzivatele } from "../models/user.model.js";
import { vytvorToken } from "../config/jwt.js";

export async function registrace(req, res) {
const { name, email, password, role } = req.body;

const hash = await bcrypt.hash(password, 10);

const finalRole = role || "student";

await vytvorUzivatele({
name,
email,
password: hash,
role: finalRole,
});

res.json({ message: "Registrace OK" });
}

export async function login(req, res) {
const { email, password } = req.body;

const user = await najdiUzivateleEmail(email);

if (!user) return res.status(401).json({ error: "Uživatel neexistuje" });

const ok = await bcrypt.compare(password, user.password);

if (!ok) return res.status(401).json({ error: "Špatné heslo" });

const token = vytvorToken(user);

res.json({ token, user });
}
