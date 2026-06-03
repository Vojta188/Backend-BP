import { openai } from "../config/ai.js";

export async function generujLekci(tema, pocetOtazek = 10) {

try {

const prompt = `
Jsi učitel.

Vrať POUZE validní JSON.

Téma: ${tema}
Počet otázek: ${pocetOtazek}

Formát:
{
"text_lehky": "",
"text_tezky": "",
"otazky":[
{
"obtiznost":"lehka",
"otazka":"",
"a":"",
"b":"",
"c":"",
"d":"",
"spravna":"A",
"vysvetleni":""
}
]
}

- Správná odpověď musí být náhodně mezi A/B/C/D.
- V rámci všech otázek se snaž o přibližně rovnoměrné rozložení (A,B,C,D).
- Nepreferuj písmeno A.
`;

const response = await openai.chat.completions.create({
model: "gpt-4o-mini",
messages: [{ role: "user", content: prompt }],
temperature: 0.5
});

let text = response.choices[0].message.content;

/// 🔥 odstranění ```json
text = text.replace(/```json/g, "").replace(/```/g, "").trim();

let json;

try {
json = JSON.parse(text);
} catch (err) {
console.log("NEPLATNY JSON OD AI:");
console.log(text);
return null;
}

return {
text_lehky: json.text_lehky,
text_tezky: json.text_tezky,
otazky: json.otazky.map(q => ({
question: q.otazka,
a: q.a,
b: q.b,
c: q.c,
d: q.d,
correct: q.spravna,
explanation: q.vysvetleni,
difficulty: q.obtiznost === "lehka" ? "easy" : "hard"
}))
};

} catch (err) {
console.log("OPENAI ERROR:", err.message);
return null;
}

}