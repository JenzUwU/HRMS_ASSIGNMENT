/**
 * Client-side "export as PDF" for a single candidate's engagement journey.
 *
 * The stack is pure frontend (no PDF library, no backend), so this renders a
 * print-optimised HTML document for that ONE candidate in a new window and
 * triggers the browser's print dialog, where the user picks "Save as PDF".
 * Nothing from other candidates is included.
 */

interface Row {
  label: string;
  value: string;
}

export interface JourneyExportData {
  candidateName: string;
  role: string;
  recruiter: string;
  riskLevel: string;
  engagementScore: number;
  status: string;
  stages: { label: string; status: string; date: string }[];
  timeline: { when: string; title: string; detail: string; actor: string }[];
  communications: { when: string; channel: string; subject: string }[];
  tasks: { title: string; status: string; due: string }[];
  notes: { author: string; when: string; body: string }[];
  documents: { name: string; status: string }[];
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

function summary(rows: Row[]): string {
  return rows
    .map(
      (r) =>
        `<div class="kv"><span class="k">${esc(r.label)}</span><span class="v">${esc(
          r.value,
        )}</span></div>`,
    )
    .join("");
}

function section(title: string, body: string): string {
  return `<section><h2>${esc(title)}</h2>${body || '<p class="muted">Nothing recorded.</p>'}</section>`;
}

export function exportJourneyPdf(d: JourneyExportData) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
  if (!win) {
    return false;
  }

  const stages = d.stages
    .map(
      (s) =>
        `<li><strong>${esc(s.label)}</strong>, ${esc(s.status)}${
          s.date ? ` · ${esc(s.date)}` : ""
        }</li>`,
    )
    .join("");

  const timeline = d.timeline
    .map(
      (e) =>
        `<li><span class="muted">${esc(e.when)}</span> · <strong>${esc(
          e.title,
        )}</strong>${e.detail ? `: ${esc(e.detail)}` : ""} <em>(${esc(
          e.actor,
        )})</em></li>`,
    )
    .join("");

  const comms = d.communications
    .map(
      (c) =>
        `<li><span class="muted">${esc(c.when)}</span> · ${esc(
          c.channel,
        )}: ${esc(c.subject)}</li>`,
    )
    .join("");

  const tasks = d.tasks
    .map(
      (t) =>
        `<li><strong>${esc(t.title)}</strong>, ${esc(t.status)}${
          t.due ? ` · due ${esc(t.due)}` : ""
        }</li>`,
    )
    .join("");

  const notes = d.notes
    .map(
      (n) =>
        `<li><span class="muted">${esc(n.author)}, ${esc(
          n.when,
        )}</span><br/>${esc(n.body)}</li>`,
    )
    .join("");

  const docs = d.documents
    .map((x) => `<li>${esc(x.name)}, ${esc(x.status)}</li>`)
    .join("");

  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(d.candidateName)}, Engagement Journey</title>
<style>
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; color: #2b2520; margin: 40px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .06em; color: #fc8019; margin: 22px 0 8px; border-bottom: 1px solid #f0e6dd; padding-bottom: 4px; }
  .sub { color: #747474; margin: 0 0 18px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 6px; }
  .kv { display: flex; justify-content: space-between; border-bottom: 1px dotted #e7ddd3; padding: 3px 0; }
  .k { color: #747474; } .v { font-weight: 600; }
  ul { margin: 0; padding-left: 18px; } li { margin: 4px 0; }
  .muted { color: #747474; }
  footer { margin-top: 28px; color: #9a9a9a; font-size: 11px; border-top: 1px solid #f0e6dd; padding-top: 8px; }
  @media print { body { margin: 16mm; } }
</style></head><body>
<h1>${esc(d.candidateName)}</h1>
<p class="sub">Engagement Journey report</p>
<div class="grid">${summary([
    { label: "Role", value: d.role },
    { label: "Recruiter", value: d.recruiter },
    { label: "Status", value: d.status },
    { label: "Risk level", value: d.riskLevel },
    { label: "Engagement score", value: `${d.engagementScore}/100` },
  ])}</div>
${section("Journey stages", stages ? `<ul>${stages}</ul>` : "")}
${section("Timeline", timeline ? `<ul>${timeline}</ul>` : "")}
${section("Communications", comms ? `<ul>${comms}</ul>` : "")}
${section("Tasks", tasks ? `<ul>${tasks}</ul>` : "")}
${section("HR notes", notes ? `<ul>${notes}</ul>` : "")}
${section("Documents", docs ? `<ul>${docs}</ul>` : "")}
<footer>Generated ${esc(new Date().toLocaleString())} · HRMS prototype</footer>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`);
  win.document.close();
  return true;
}
