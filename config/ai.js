import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openaiKeys = Object.keys(process.env).filter((key) =>
  key.toLowerCase().includes("openai")
);

console.log("OPENAI-related env keys:", openaiKeys);
console.log("OPENAI_API_KEY exists:", Boolean(process.env.OPENAI_API_KEY));
console.log("OPENAI_API_KEY length:", process.env.OPENAI_API_KEY?.length || 0);
console.log("TEST_VAR:", process.env.TEST_VAR);
console.log("OPENAI_API_KEY:", Boolean(process.env.OPENAI_API_KEY));
const apiKey = process.env.OPENAI_API_KEY?.trim();

if (!apiKey) {
  console.warn("OPENAI_API_KEY není dostupný v Railway runtime.");
}

export const openai = apiKey ? new OpenAI({ apiKey }) : null;