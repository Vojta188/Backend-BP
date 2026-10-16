import { openai } from "../config/ai.js";

export async function generujVysvetleni(otazka, spravna, odpoved) {

const prompt = `
Student odpověděl špatně.

Otázka: ${otazka}
Správná odpověď: ${spravna}
Student odpověděl: ${odpoved}

Vysvětli česky:
- proč je odpověď špatně
- jaká je správná
- stručně
- Odpovědi vysvětluj podle jejich textu, ne podle písmen A/B/C/D.
`;

const response = await openai.chat.completions.create({
model: "gpt-4o-mini",
messages: [{ role: "user", content: prompt }],
temperature: 0.5
});

return response.choices[0].message.content;
}
