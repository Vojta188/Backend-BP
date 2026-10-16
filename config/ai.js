import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY?.trim();

if (!apiKey) {
  console.warn("OPENAI_API_KEY není nastaven.");
}

export const openai = apiKey ? new OpenAI({ apiKey }) : null;
