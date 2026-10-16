import { randomInt } from "node:crypto";

const letters = ["A", "B", "C", "D"];

export function promichejOdpovedi(question, randomIndex = randomInt) {
  const options = letters.map((letter) => ({
    text: question[letter.toLowerCase()],
    isCorrect: letter === question.correct,
  }));

  for (let i = options.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    ...question,
    a: options[0].text,
    b: options[1].text,
    c: options[2].text,
    d: options[3].text,
    correct: letters[options.findIndex((option) => option.isCorrect)],
  };
}
