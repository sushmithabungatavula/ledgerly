# Ledgerly

**Live demo:** https://ledgerly-eight-sepia.vercel.app

An expense tracker that sorts your transactions with a small machine learning model. When the model guesses wrong, you fix it once and it learns.

## The problem

Bank statements show raw strings like `SQ *BLUE MOON CAFE` or `AMAZON MKTPL*2K4`. Sorting 50 to 100 of them a month by hand takes time, so most people stop tracking.

Keyword rules fail too. You can't write a rule for every merchant. Rules can't say "I'm not sure." And people categorize differently: one person files Peloton under Subscriptions, another under Health.

Ledgerly uses a classifier that learns your categories from your corrections and reports its confidence. Unsure guesses go to a review queue.

## Features

- Live category guess as you type, with the top 4 categories and the words behind the guess
- Review queue for guesses under 60% confidence
- Instant retraining when you change any category
- Receipt scanning: take a photo or pick several, and Ledgerly reads the store, total and date, then sorts each one. Text recognition runs in your browser, so photos are never uploaded.
- Paste import for bank lines (`description, amount, date`)
- Dashboard with monthly totals, month-over-month change, and a spending donut
- Spending page with per-category bars and a daily chart
- Model page with live accuracy, an accuracy-over-time chart, per-category precision, recall, and F1, a confusion matrix, 5-fold cross-validation, and learned words per category
- 4 color palettes, each with light and dark mode
- Responsive layout with a bottom tab bar on phones

## The model

Multinomial Naive Bayes, written from scratch. No ML library.

Features per transaction:

1. Single words, lowercased, with numbers and store codes removed
2. Word pairs, such as `whole foods`
3. An amount range token (under $10, $10 to $30, $30 to $80, $80 to $200, $200 to $600, over $600), counted at half weight

Prediction uses Laplace smoothing and log probabilities, then converts scores to percentages.

Training starts with 69 hand-written examples across 10 categories. Every saved expense becomes a training example. Corrections count 3x, so one fix changes future guesses fast. The model retrains from all examples on each change, which takes a few milliseconds at this size.

### Why Naive Bayes

- Learns from very little data
- Trains in milliseconds, so retraining on every correction works
- Explainable: you can see which words drove each guess
- Runs in the browser, so no server sees your transactions

The tradeoff: it assumes words act independently. For short merchant strings, this costs little.

## Evaluation

- **Live accuracy (prequential):** the model guesses before you confirm or fix. Each guess is graded against your final answer.
- **Rolling accuracy chart:** last-10 accuracy over time. A rising line shows the feedback loop works.
- **Per-category precision, recall, F1** and macro F1
- **Confusion matrix**
- **5-fold cross-validation** with a seeded shuffle, so results repeat

On the built-in sample month, accuracy rises from 67% in the first half to 85% in the second half as the model learns from corrections. The test suite checks this.

Cross-validation scores lower, around 50%, because most starter merchants appear once. It mostly measures guesses on names the model has never seen. Live accuracy runs higher because real merchants repeat.

## Tech stack

- Plain JavaScript, HTML, and CSS. No framework, no build step.
- Custom Naive Bayes classifier
- Hand-built SVG charts and icons
- [Tesseract.js](https://github.com/naptha/tesseract.js) for reading receipt photos, loaded only the first time you scan
- CSS custom properties for theming
- Onest font from Google Fonts
- Storage: a private per-user document when hosted as a Claude artifact, with browser localStorage as backup. Run locally, it uses localStorage only.

## Project layout

```
index.html                 The full app in one file
src/classifier.js          The model on its own, for reading and testing
src/receipt.js             Receipt text parser (store, total, date)
tests/classifier.test.js   Model tests (Node's built-in test runner)
tests/receipt.test.js      Receipt parser tests
package.json
```

`index.html` inlines the same code as `src/classifier.js` and `src/receipt.js`, so the app runs as a single file. If you change either, update both copies.

## Run it

Open `index.html` in a browser. That's it.

Or serve it:

```
npx serve .
```

## Test it

Needs Node 18 or later.

```
npm test
```

The 15 tests cover the model (tokenizer, amount ranges, probability output, known merchants, learning from one correction, unknown-merchant detection, accuracy improvement across the sample month) and the receipt parser (picking the total over subtotal, tax and cash, several date formats, and skipping addresses and logo noise when finding the store name).

## Limits

- Cold start: the model knows 69 merchants at first
- No bank connection: you scan, add or paste transactions
- Receipt reading depends on photo quality. Crumpled or faded receipts may need a manual fix before you add them.
- Full retrain on every change: fine for personal data, not for bank scale

## Next steps

- Add logistic regression and compare both models on the same data
- Report accuracy on real exported bank data
- Measure how many corrections a new merchant needs before the model gets it right

## License

MIT
