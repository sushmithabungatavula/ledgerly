"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { parseReceipt, findDate, amountsIn, receiptHint } = require("../src/receipt.js");

test("grocery receipt: picks total over subtotal, tax and cash tendered", () => {
  const r = parseReceipt(`TRADER JOE'S
1700 E Madison St
Seattle, WA 98122
Store #130 (206) 322-7268
BANANAS 0.87
GREEK YOGURT 5.49
SPINACH 2.29
SUBTOTAL 8.65
TAX 0.00
TOTAL $8.65
CASH 20.00
CHANGE 11.35
09/14/2026 12:41 PM`);
  assert.strictEqual(r.desc, "TRADER JOES");
  assert.strictEqual(r.amt, 8.65);
  assert.strictEqual(r.date, "2026-09-14");
});

test("restaurant receipt: amount due beats plain total, skips logo noise", () => {
  const r = parseReceipt(`~~ @@ ~~
Blue Moon Cafe
Server: Ana Table 4
2 Latte 9.00
Subtotal 9.00
Tax 0.92
Total 9.92
Tip 2.00
Amount Due 11.92
Sep 3, 2026`);
  assert.strictEqual(r.desc, "Blue Moon Cafe");
  assert.strictEqual(r.amt, 11.92);
  assert.strictEqual(r.date, "2026-09-03");
});

test("total on the next line and thousands separators", () => {
  const r = parseReceipt(`BEST BUY
TOTAL
$1,249.99
2026-08-30`);
  assert.strictEqual(r.amt, 1249.99);
  assert.strictEqual(r.date, "2026-08-30");
});

test("prefers a merchant the model knows when the first line is noise", () => {
  const r = parseReceipt(`Xqzv Rrt\nSHELL\nPUMP 04 UNLEADED\nTOTAL 47.90`, { isKnown: w => w === "shell" });
  assert.strictEqual(r.desc, "SHELL");
});

test("falls back to the largest amount when no total line exists", () => {
  assert.strictEqual(parseReceipt("CVS\nITEM 3.99\nITEM 12.50").amt, 12.5);
});

test("dates in several formats", () => {
  assert.strictEqual(findDate("27/09/2026"), "2026-09-27");
  assert.strictEqual(findDate("9-5-26"), "2026-09-05");
  assert.strictEqual(findDate("14 Aug 2026"), "2026-08-14");
  assert.strictEqual(findDate("no date here"), null);
});

test("amounts accept comma decimals and ignore plain integers", () => {
  assert.deepStrictEqual(amountsIn("TOTAL 12,34"), [12.34]);
  assert.deepStrictEqual(amountsIn("QTY 3 ITEMS"), []);
});

test("empty text gives empty fields instead of throwing", () => {
  assert.deepStrictEqual(parseReceipt(""), { desc: "", descGuessed: false, amt: null, date: null, hint: null });
});

test("dates survive common OCR slips", () => {
  assert.strictEqual(findDate("10/O7/2026"), "2026-10-07");
  assert.strictEqual(findDate("1O / 07 / 2026 14:22"), "2026-10-07");
  assert.strictEqual(findDate("l0-07-26"), "2026-10-07");
});

test("skips a low-confidence script logo and takes the printed store name", () => {
  const text = `Suen\nGREEN SUPERMARKET\n12 Oak Ave\nMILK 3.49\nTOTAL 27.35`;
  const r = parseReceipt(text, { lowConf: l => l === "Suen" });
  assert.strictEqual(r.desc, "GREEN SUPERMARKET");
});

test("store-type word wins even without confidence data", () => {
  assert.strictEqual(parseReceipt(`Grn Sprmkt Co\nGREEN SUPERMARKET\nTOTAL 9.00`).desc, "GREEN SUPERMARKET");
});

test("item words hint at the category of an unknown store", () => {
  assert.strictEqual(receiptHint("MILK 3.49\nBREAD 2.10\nBANANAS 1.20").cat, "Groceries");
  assert.strictEqual(receiptHint("Server: Ana\nLatte 5.00\nTip 1.00").cat, "Dining");
  assert.strictEqual(receiptHint("UNLEADED 12.1 GAL\nPUMP 4").cat, "Transport");
  assert.strictEqual(receiptHint("THANK YOU"), null);
});

test("unreadable logo and no other name: names the store by its items instead of gibberish", () => {
  const text = `Sumantet\n2 APPLE 1.00\n3 BANANA 1.50\n1 MILK 1.50\n1 CHEESE 2.80\nTOTAL 27.35\nCASH 30.00\nCHANGE 2.65`;
  const r = parseReceipt(text, { lowConf: l => l === "Sumantet" });
  assert.strictEqual(r.desc, "Grocery store");
  assert.strictEqual(r.descGuessed, true);
  assert.strictEqual(r.amt, 27.35);
  assert.strictEqual(r.date, null);
});
