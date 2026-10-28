/* TypeFlow engine: word comparison + score metrics (no DOM, testable in Node) */
(function (root) {
  'use strict';

  function tokenize(text) {
    return text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  }

  /**
   * Word-level alignment (edit distance). A word that is not a 100% exact match
   * (case, spelling, punctuation) is an error. Handles additions, omissions,
   * substitutions, repetitions and incomplete words. Reference words the typist
   * never reached are NOT counted as errors.
   */
  function diff(ref, typed) {
    const n = typed.length, m = ref.length, W = m + 1;
    const dp = new Uint32Array((n + 1) * W);
    for (let j = 0; j <= m; j++) dp[j] = j;
    for (let i = 1; i <= n; i++) {
      dp[i * W] = i;
      for (let j = 1; j <= m; j++) {
        const c = typed[i - 1] === ref[j - 1] ? 0 : 1;
        const a = dp[(i - 1) * W + j - 1] + c;
        const b = dp[(i - 1) * W + j] + 1;
        const d = dp[i * W + j - 1] + 1;
        dp[i * W + j] = a < b ? (a < d ? a : d) : (b < d ? b : d);
      }
    }
    // best reference prefix = the part of the paragraph the user actually covered
    let jBest = 0, best = Infinity;
    for (let j = 0; j <= m; j++) {
      if (dp[n * W + j] < best) { best = dp[n * W + j]; jBest = j; }
    }
    const ops = [];
    let i = n, j = jBest;
    while (i > 0 || j > 0) {
      const cur = dp[i * W + j];
      if (i > 0 && j > 0 && typed[i - 1] === ref[j - 1] && cur === dp[(i - 1) * W + j - 1]) {
        ops.push({ type: 'ok', ref: ref[j - 1], typed: typed[i - 1] }); i--; j--; continue;
      }
      if (i > 0 && cur === dp[(i - 1) * W + j] + 1) { ops.push({ type: 'add', typed: typed[i - 1] }); i--; continue; }
      if (j > 0 && cur === dp[i * W + j - 1] + 1) { ops.push({ type: 'omit', ref: ref[j - 1] }); j--; continue; }
      ops.push({ type: 'sub', ref: ref[j - 1], typed: typed[i - 1] }); i--; j--;
    }
    ops.reverse();
    return { errors: best === Infinity ? 0 : best, ops: ops, covered: jBest };
  }

  /** All the numbers shown on the result screen. */
  function metrics(keystrokes, backspaces, errors, seconds) {
    const minutes = Math.max(seconds, 1) / 60;
    const wordsTyped = keystrokes / 5;
    const ignorable = wordsTyped * 0.05;
    const penalty = Math.max(0, (errors - ignorable) * 10);
    const gross = wordsTyped / minutes;
    const net = Math.max(0, (wordsTyped - penalty) / minutes);
    return {
      fullErrors: errors,
      totalErrors: errors,
      ignorable: ignorable,
      penalty: penalty,
      errorPct: wordsTyped > 0 ? (errors / wordsTyped) * 100 : 0,
      keystrokes: keystrokes,
      backspaces: backspaces,
      wordsTyped: wordsTyped,
      grossWpm: gross,
      netWpm: net,
      accuracy: gross > 0 ? (net / gross) * 100 : 0,
      seconds: seconds
    };
  }

  const api = { tokenize: tokenize, diff: diff, metrics: metrics };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TypeEngine = api;
})(typeof window !== 'undefined' ? window : this);
