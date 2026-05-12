const form = document.getElementById("upload-form");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const summaryEl = document.getElementById("summary");
const rawEl = document.getElementById("raw");
const submitBtn = document.getElementById("submit-btn");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.remove("hidden");
  statusEl.classList.toggle("text-red-600", isError);
}

function rupee(n) {
  if (n === null || n === undefined) return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function gapsTable(gaps) {
  if (!gaps || gaps.length === 0) {
    return `<p class="text-slate-600 text-sm">No deduction gaps to report (new regime or no qualifying deductions).</p>`;
  }
  const rows = gaps
    .map(
      (g) => `
      <tr class="border-t border-slate-200">
        <td class="py-2 pr-4 font-medium">${g.section}</td>
        <td class="py-2 pr-4 text-right">${rupee(g.limit)}</td>
        <td class="py-2 pr-4 text-right">${rupee(g.used)}</td>
        <td class="py-2 pr-4 text-right font-semibold ${
          Number(g.gap) > 0 ? "text-emerald-700" : "text-slate-400"
        }">${rupee(g.gap)}</td>
      </tr>`,
    )
    .join("");
  return `
    <table class="w-full text-sm">
      <thead class="text-slate-500 text-xs uppercase tracking-wide">
        <tr>
          <th class="text-left py-2 pr-4">Section</th>
          <th class="text-right py-2 pr-4">Limit</th>
          <th class="text-right py-2 pr-4">Used</th>
          <th class="text-right py-2 pr-4">Gap</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function anomaliesList(anomalies) {
  if (!anomalies || anomalies.length === 0) {
    return `<p class="text-slate-600 text-sm">No anomalies detected.</p>`;
  }
  const sevColor = {
    info: "bg-slate-100 text-slate-700",
    warn: "bg-amber-100 text-amber-800",
    error: "bg-red-100 text-red-800",
  };
  return `<ul class="space-y-2">${anomalies
    .map(
      (a) => `
      <li class="flex gap-3 items-start">
        <span class="text-xs uppercase px-2 py-0.5 rounded ${
          sevColor[a.severity] || sevColor.info
        }">${a.severity}</span>
        <div>
          <div class="text-sm font-medium">${a.code}</div>
          <div class="text-sm text-slate-600">${a.message}</div>
        </div>
      </li>`,
    )
    .join("")}</ul>`;
}

function render(payload) {
  const c = payload.computed;
  summaryEl.innerHTML = `
    <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold mb-3">Summary</h2>
      <dl class="grid grid-cols-2 gap-y-2 text-sm">
        <dt class="text-slate-500">Form</dt><dd>${c.form_type}</dd>
        <dt class="text-slate-500">Assessment Year</dt><dd>${c.assessment_year}</dd>
        <dt class="text-slate-500">Regime</dt><dd>${c.regime || "—"}</dd>
        <dt class="text-slate-500">Gross total income</dt><dd>${rupee(c.gross_total_income)}</dd>
        <dt class="text-slate-500">Taxable income</dt><dd>${rupee(c.total_taxable_income)}</dd>
        <dt class="text-slate-500">Total tax</dt><dd>${rupee(c.total_tax)}</dd>
      </dl>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold mb-3">Deduction gaps</h2>
      ${gapsTable(c.deduction_gaps)}
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold mb-3">Anomalies</h2>
      ${anomaliesList(c.anomalies)}
    </div>

    ${
      payload.narrative
        ? `<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="text-lg font-semibold mb-3">Narrative</h2>
            <p class="text-sm leading-relaxed whitespace-pre-line">${payload.narrative}</p>
          </div>`
        : payload.narrative_status === "suppressed_number_leak"
        ? `<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
             Narrative was suppressed: the model introduced a number not present in the
             computed insights. The numeric analysis above is unaffected.
           </div>`
        : ""
    }
  `;
  rawEl.textContent = JSON.stringify(payload, null, 2);
  resultEl.classList.remove("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resultEl.classList.add("hidden");
  setStatus("Uploading and analyzing — this can take 10-30 seconds…");
  submitBtn.disabled = true;

  const data = new FormData(form);
  try {
    const res = await fetch("/api/analyze", { method: "POST", body: data });
    const payload = await res.json();
    if (!res.ok) {
      const msg = payload?.error?.message || `HTTP ${res.status}`;
      setStatus(`Error: ${msg}`, true);
      return;
    }
    setStatus("Done.");
    render(payload);
  } catch (err) {
    setStatus(`Network error: ${err}`, true);
  } finally {
    submitBtn.disabled = false;
  }
});
