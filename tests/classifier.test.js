"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { CATS, SEED, SAMPLE, tokens, bucket, train, predict } = require("../src/classifier.js");

const seedExamples = () => SEED.map(([desc, amt, cat]) => ({ desc, amt, cat }));

test("tokenizer drops numbers and store codes, keeps word pairs and amount range", () => {
  const t = tokens("TRADER JOES #130", 52.7);
  assert.ok(t.includes("trader"));
  assert.ok(t.includes("joes"));
  assert.ok(t.includes("trader joes"));
  assert.ok(t.includes("amt:m"));
  assert.ok(!t.some(x => /\d/.test(x.replace("amt:", ""))));
});

test("amount buckets cover the full range", () => {
  assert.strictEqual(bucket(5), "xs");
  assert.strictEqual(bucket(25), "s");
  assert.strictEqual(bucket(50), "m");
  assert.strictEqual(bucket(150), "l");
  assert.strictEqual(bucket(400), "xl");
  assert.strictEqual(bucket(2100), "xxl");
});

test("top guesses are valid probabilities", () => {
  const m = train(seedExamples());
  const p = predict(m, "starbucks coffee", 6);
  const all = CATS.map(c => {
    const hit = p.top.find(t => t.cat === c);
    return hit ? hit.p : 0;
  });
  assert.ok(p.top.length <= 4);
  assert.ok(p.top.reduce((s, t) => s + t.p, 0) <= 1.0000001);
  assert.ok(all.every(x => x >= 0));
});

test("known merchants get the right category", () => {
  const m = train(seedExamples());
  assert.strictEqual(predict(m, "Starbucks", 5).cat, "Dining");
  assert.strictEqual(predict(m, "Netflix", 15.49).cat, "Subscriptions");
  assert.strictEqual(predict(m, "Delta flight", 300).cat, "Travel");
  assert.strictEqual(predict(m, "Shell gas", 45).cat, "Transport");
});

test("one weighted correction teaches a new merchant", () => {
  const ex = seedExamples();
  const before = predict(train(ex), "PCC COMMUNITY MARKETS", 60);
  ex.push({ desc: "PCC COMMUNITY MARKETS", amt: 60, cat: "Groceries", w: 3 });
  const after = predict(train(ex), "PCC COMMUNITY MARKETS", 45);
  assert.strictEqual(after.cat, "Groceries");
  if (before.cat === "Groceries") assert.ok(after.conf > before.conf);
});

test("unknown merchant is flagged as unknown", () => {
  const m = train(seedExamples());
  const p = predict(m, "Zxqv Blorp", 20);
  assert.strictEqual(p.known, false);
});

test("accuracy improves across the sample month (feedback loop)", () => {
  const ex = seedExamples();
  let m = train(ex);
  const hits = [];
  for (const [desc, amt, cat] of SAMPLE) {
    const p = predict(m, desc, amt);
    hits.push(p.cat === cat ? 1 : 0);
    ex.push({ desc, amt, cat, w: p.cat === cat ? 1 : 3 });
    m = train(ex);
  }
  const half = Math.floor(hits.length / 2);
  const first = hits.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const second = hits.slice(half).reduce((a, b) => a + b, 0) / (hits.length - half);
  console.log(`first half ${Math.round(first * 100)}%, second half ${Math.round(second * 100)}%`);
  assert.ok(second >= first);
});
