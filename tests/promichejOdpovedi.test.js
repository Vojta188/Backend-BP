import assert from "node:assert/strict";
import test from "node:test";
import { promichejOdpovedi } from "../utils/promichejOdpovedi.js";

const letters = ["A", "B", "C", "D"];
const fields = ["a", "b", "c", "d"];
const question = {
  question: "Kolik je 2 + 2?",
  a: "3", b: "4", c: "5", d: "6", correct: "B",
  difficulty: "easy", explanation: "Součet dvou a dvou je čtyři.",
};

test("Všech 24 pořadí zachová správný text pro každé původní správné písmeno", () => {
  for (const correct of letters) {
    const input = { ...question, correct };
    const orders = new Set();
    const positions = { A: 0, B: 0, C: 0, D: 0 };
    for (let first = 0; first < 4; first++) {
      for (let second = 0; second < 3; second++) {
        for (let third = 0; third < 2; third++) {
          const draws = [first, second, third];
          const actual = promichejOdpovedi(input, (upperBound) => {
            const value = draws.shift();
            assert.ok(value >= 0 && value < upperBound);
            return value;
          });
          const texts = fields.map((key) => actual[key]);
          assert.deepEqual([...texts].sort(), fields.map((key) => input[key]).sort());
          assert.equal(actual[actual.correct.toLowerCase()], input[correct.toLowerCase()]);
          positions[actual.correct]++;
          orders.add(JSON.stringify(texts));
        }
      }
    }
    assert.equal(orders.size, 24);
    assert.deepEqual(positions, { A: 6, B: 6, C: 6, D: 6 });
  }
});

test("Správnou možnost sleduje podle původu i při shodném textu dvou možností", () => {
  const actual = promichejOdpovedi({ ...question, a: "4", b: "4" }, () => 0);
  assert.equal(actual.correct, "A");
  assert.equal(actual.a, "4");
  assert.equal(actual.d, "4");
});

test("Nemění původní otázku ani její zadání, obtížnost a vysvětlení", () => {
  const input = Object.freeze({ ...question });
  const actual = promichejOdpovedi(input, () => 0);
  assert.deepEqual(input, question);
  assert.notEqual(actual, input);
  for (const key of ["question", "difficulty", "explanation"]) {
    assert.equal(actual[key], input[key]);
  }
});

test("Výchozí zdroj náhody vrací úplnou otázku se správným označením", () => {
  const actual = promichejOdpovedi(question);
  assert.deepEqual(fields.map((key) => actual[key]).sort(), ["3", "4", "5", "6"]);
  assert.equal(actual[actual.correct.toLowerCase()], "4");
});
