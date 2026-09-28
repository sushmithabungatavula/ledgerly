/* Receipt parser: turns OCR text from a receipt photo into a merchant, total and date.
   index.html inlines the same code. If you change it here, update both. */
"use strict";

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const AMT_RE = /(?:^|[^\d.,])-?\$?\s?(\d{1,3}(?:[,.]\d{3})*[.,]\d{2}|\d+[.,]\d{2})(?![\d])/g;
const SKIP_MERCHANT = /receipt|welcome|thank|customer|copy|invoice|order\s*#|store\s*#|tel\b|phone|fax|www\.|https?:|@|\.com\b|cashier|server|table|guest|register|trans(action)?\b|date|time/i;
const ADDRESS = /^\d+\s|\b(st|ave|rd|blvd|suite|ste|street|road|drive|dr|hwy|way|lane|ln|pkwy)\b\.?|\b[A-Z]{2}\s*\d{5}\b/i;

function toAmount(s) {
  // Last separator followed by two digits is the decimal point, the rest are thousands marks
  const m = s.match(/^(.*)[.,](\d{2})$/);
  if (!m) return NaN;
  return parseFloat(m[1].replace(/[.,\s]/g, "") + "." + m[2]);
}

function amountsIn(line) {
  const out = [];
  let m;
  AMT_RE.lastIndex = 0;
  while ((m = AMT_RE.exec(line))) {
    const v = toAmount(m[1]);
    if (v > 0 && v < 100000) out.push(v);
  }
  return out;
}

function pad(n) { return String(n).padStart(2, "0"); }
function ymd(y, mo, d) {
  y = +y; mo = +mo; d = +d;
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2099 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function findDate(text) {
  let m;
  if ((m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/))) {
    const r = ymd(m[1], m[2], m[3]); if (r) return r;
  }
  if ((m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/))) {
    // US order first; if the first number can't be a month, read it as day/month
    const r = +m[1] > 12 ? ymd(m[3], m[2], m[1]) : ymd(m[3], m[1], m[2]); if (r) return r;
  }
  if ((m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i))) {
    const r = ymd(m[3], MONTHS[m[1].toLowerCase()], m[2]); if (r) return r;
  }
  if ((m = text.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/i))) {
    const r = ymd(m[3], MONTHS[m[2].toLowerCase()], m[1]); if (r) return r;
  }
  return null;
}

function findTotal(lines) {
  const RANKS = [
    [/grand\s*total|amount\s*due|balance\s*due|total\s*due|amount\s*paid|total\s*paid/i, 3],
    [/\btotal\b/i, 2],
    [/\b(amount|charged|visa|mastercard|amex|debit|credit)\b/i, 1],
  ];
  const NOT_TOTAL = /sub\s*-?\s*total|total\s*(tax|savings?|discount|items?|qty|quantity)|\btax\b|savings|you\s*saved|change|tip\s*guide|suggested/i;
  let best = null;
  lines.forEach((line, i) => {
    if (NOT_TOTAL.test(line)) return;
    const hit = RANKS.find(([re]) => re.test(line));
    if (!hit) return;
    let vals = amountsIn(line);
    if (!vals.length && i + 1 < lines.length) vals = amountsIn(lines[i + 1]);
    if (!vals.length) return;
    const v = vals[vals.length - 1];
    if (!best || hit[1] > best.rank || (hit[1] === best.rank && v > best.v)) best = { v, rank: hit[1] };
  });
  if (best) return best.v;
  // No total line: take the largest amount that isn't cash handed over or change given back
  const all = lines.filter(l => !/change|cash|tender|savings/i.test(l)).flatMap(amountsIn);
  return all.length ? Math.max(...all) : null;
}

function cleanMerchant(line) {
  // Drop apostrophes so "JOE'S" reads as "JOES", the way bank statements and the model spell it
  return line.replace(/'/g, "").replace(/[^A-Za-z0-9&.\- ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

function findMerchant(lines, isKnown) {
  const cands = lines.slice(0, 8)
    .filter(l => (l.match(/[A-Za-z]/g) || []).length >= 3)
    .filter(l => !SKIP_MERCHANT.test(l) && !ADDRESS.test(l) && !amountsIn(l).length && !findDate(l))
    .map(cleanMerchant)
    .filter(l => l.length >= 3);
  if (!cands.length) return "";
  // Prefer a line the model already recognizes, since logos often OCR as noise above the name
  if (isKnown) {
    const k = cands.find(l => l.toLowerCase().split(/[^a-z]+/).some(w => w.length > 2 && isKnown(w)));
    if (k) return k;
  }
  return cands[0];
}

function parseReceipt(text, opts) {
  const lines = String(text || "").split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  return {
    desc: findMerchant(lines, opts && opts.isKnown),
    amt: findTotal(lines),
    date: findDate(lines.join("\n")),
  };
}

if (typeof module !== "undefined") module.exports = { parseReceipt, findTotal, findDate, findMerchant, amountsIn };
