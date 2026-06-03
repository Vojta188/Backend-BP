import { db } from "../config/databaze.js";

export async function najdiUzivateleEmail(email) {
const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
return rows[0];
}

export async function vytvorUzivatele(user) {
await db.query(
"INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)",
[user.name, user.email, user.password, user.role]
);
}
