import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export function vytvorToken(user) {
return jwt.sign(
{
id: user.id,
role: user.role,
},
process.env.JWT_SECRET,
{ expiresIn: "7d" }
);
}
