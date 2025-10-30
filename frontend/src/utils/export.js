// frontend/src/utils/export.js

/**
 * Tiny CSV encoder that quotes cells if needed.
 */
function toCsvCell(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  // quote if contains comma, quote, or newline
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsvRow(arr) {
  return arr.map(toCsvCell).join(",");
}

function downloadTextFile(filename, text) {
  // In the browser: create a blob link and click it
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "data.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  } else {
    // Non-DOM environments (SSR/build) just noop
    // (The function is only invoked client-side by a button click.)
  }
}

/**
 * Export encounter results to CSV.
 *
 * @param {string} filename - e.g. "tpka_builder.csv"
 * @param {object} summary  - { source, trials, initiative, strategy, win_rate, avg_damage, ... }
 * @param {object} histRounds - { [roundNumber]: count, ... }
 */
export function exportEncounterCsv(filename, summary = {}, histRounds = {}) {
  const lines = [];

  // Summary section
  lines.push(toCsvRow(["Summary Key", "Value"]));
  const orderedKeys = [
    "source",
    "trials",
    "initiative",
    "strategy",
    "win_rate",
    "avg_damage",
  ];
  orderedKeys.forEach((k) => {
    if (k in summary) lines.push(toCsvRow([k, summary[k]]));
  });
  // include any extra keys not covered above
  Object.keys(summary)
    .filter((k) => !orderedKeys.includes(k))
    .forEach((k) => lines.push(toCsvRow([k, summary[k]])));

  // spacer
  lines.push("");

  // Histogram section
  lines.push(toCsvRow(["Round", "Count"]));
  Object.keys(histRounds)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .forEach((round) => {
      lines.push(toCsvRow([round, histRounds[round]]));
    });

  const csv = lines.join("\n");
  downloadTextFile(filename || "tpka_results.csv", csv);
}
