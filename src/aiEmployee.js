/*
 * src/aiEmployee.js
 * The logic behind the AI employee pilot preview. Loaded by the page (index.html) and the tests.
 *
 *   screen(brief, candidates, memory)   the recruiting AI employee: evidence per requirement, a decision per
 *                                       candidate, exceptions routed to a person, past approvals cited
 *   decide(queue, id, verdict, memory)  a person approves or rejects an exception; the decision is remembered
 *   handoffs(results, approvals)        approved shortlist handed to the scheduling agent, with outreach drafts
 *   route(app)                          how an AI employee should reach a business application: MCP, API,
 *                                       browser automation, a reverse-engineering study, or not at all
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AIEmployee = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULTS = { salaryStretch: 0.15, today: '2026-10-24' };

  function settingsOf(o) { var s = JSON.parse(JSON.stringify(DEFAULTS)); Object.keys(o || {}).forEach(function (k) { s[k] = o[k]; }); return s; }
  function norm(x) { return String(x || '').toLowerCase().trim(); }
  function has(list, skill) { return (list || []).map(norm).indexOf(norm(skill)) >= 0; }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  /*
   * screen: the model's job in the delivered build is reading resumes into the candidate fields below.
   * Every decision here is code, so the same candidate always gets the same answer and the reason is shown.
   */
  function screen(brief, candidates, memory, opts) {
    var s = settingsOf(opts), out = [], skipped = [], mem = memory || [];
    if (!brief || !(brief.mustHave || []).length) return { results: [], skipped: [{ reason: 'the role brief has no must-have requirements' }], queue: [] };
    (candidates || []).forEach(function (c, i) {
      if (!c || !c.name) { skipped.push({ row: i + 1, reason: 'no candidate name' }); return; }
      var evidence = [], missing = [], exceptions = [], rejects = [];
      brief.mustHave.forEach(function (m) { if (has(c.skills, m)) evidence.push(m); else missing.push(m); });
      var nice = (brief.niceToHave || []).filter(function (m) { return has(c.skills, m); });
      if (missing.length) rejects.push('missing must-have: ' + missing.join(', '));
      if (brief.minYears && typeof c.years === 'number' && c.years < brief.minYears) rejects.push(c.years + ' years, role needs ' + brief.minYears);
      if (typeof c.years !== 'number') exceptions.push({ type: 'missing-info', text: 'years of experience not stated' });
      if (!brief.remote && c.location && norm(c.location) !== norm(brief.location)) {
        if (c.relocate) exceptions.push({ type: 'relocation', text: 'based in ' + c.location + ', willing to relocate' });
        else rejects.push('based in ' + c.location + ', role is on-site in ' + brief.location);
      }
      if (typeof c.salaryAsk === 'number' && brief.salaryMax) {
        var over = c.salaryAsk / brief.salaryMax - 1;
        if (over > s.salaryStretch) rejects.push('asks ' + money(c.salaryAsk) + ', ' + Math.round(over * 100) + '% over the ' + money(brief.salaryMax) + ' max');
        else if (over > 0) exceptions.push({ type: 'salary', text: 'asks ' + money(c.salaryAsk) + ', ' + Math.round(over * 100) + '% over the ' + money(brief.salaryMax) + ' max' });
      } else if (typeof c.salaryAsk !== 'number') exceptions.push({ type: 'missing-info', text: 'salary expectation not stated' });
      if (c.visa === 'needs sponsorship' && !brief.sponsor) rejects.push('needs visa sponsorship, which this role does not offer');
      else if (!c.visa || c.visa === 'unknown') exceptions.push({ type: 'visa', text: 'work authorization unknown' });
      if (!c.email) exceptions.push({ type: 'missing-info', text: 'no email to reach them' });
      var score = Math.round(100 * (evidence.length / brief.mustHave.length) * 0.7 + 30 * (brief.niceToHave && brief.niceToHave.length ? nice.length / brief.niceToHave.length : 0));
      var decision = rejects.length ? 'reject' : exceptions.length ? 'needs approval' : 'shortlist';
      // Cite the most recent past decision on the same kind of exception, so the approver sees precedent.
      var precedent = exceptions.map(function (x) { return mem.filter(function (m) { return m.type === x.type; }).slice(-1)[0]; }).filter(Boolean);
      out.push({ id: c.id, name: c.name, score: score, decision: decision, evidence: evidence, nice: nice, rejects: rejects, exceptions: exceptions, precedent: precedent, email: c.email || null, source: c.source || '' });
    });
    var rank = { shortlist: 0, 'needs approval': 1, reject: 2 };
    out.sort(function (a, b) { return rank[a.decision] - rank[b.decision] || b.score - a.score; });
    var queue = out.filter(function (r) { return r.decision === 'needs approval'; }).map(function (r) { return { id: r.id, name: r.name, exceptions: r.exceptions, precedent: r.precedent, status: 'waiting' }; });
    return { results: out, skipped: skipped, queue: queue };
  }

  /*
   * decide: an approval or rejection by a person. Each exception type is written to memory with the outcome,
   * so the next time the same kind of exception comes up the agent shows what was decided before.
   */
  function decide(queue, id, verdict, memory, who, when) {
    var item = (queue || []).filter(function (q) { return q.id === id; })[0];
    if (!item) return { ok: false, error: 'nothing waiting for ' + id };
    if (verdict !== 'approve' && verdict !== 'reject') return { ok: false, error: 'verdict must be approve or reject' };
    if (item.status !== 'waiting') return { ok: false, error: item.name + ' was already ' + item.status };
    item.status = verdict === 'approve' ? 'approved' : 'rejected';
    item.exceptions.forEach(function (x) { memory.push({ type: x.type, outcome: item.status, candidate: item.name, text: x.text, by: who || 'Victoria', at: when || DEFAULTS.today }); });
    return { ok: true, item: item };
  }

  function handoffs(screened, queue, brief) {
    var approved = (queue || []).filter(function (q) { return q.status === 'approved'; }).map(function (q) { return q.id; });
    return screened.results.filter(function (r) { return r.decision === 'shortlist' || approved.indexOf(r.id) >= 0; }).map(function (r) {
      return { to: 'Scheduling agent', candidate: r.name, task: 'Offer three 30-minute slots this week for the ' + brief.title + ' screen', draft: 'Hi ' + r.name.split(' ')[0] + ', your background in ' + r.evidence.slice(0, 2).join(' and ') + ' stood out for our ' + brief.title + ' role. Would you be open to a short call this week?', email: r.email, status: r.email ? 'ready for approval' : 'held: no email' };
    });
  }

  /*
   * route: the order matters. Use what the vendor supports before anything else; reverse-engineering is a
   * last resort for interoperability, only on software the business is licensed to use and only where the
   * licence allows analysis. Never to get around a login, a paywall or a technical protection.
   */
  function route(app) {
    var a = app || {}, why = [], cautions = [];
    if (a.hasMcp) { why.push('an MCP server exists: Claude can use it directly with scoped permissions'); return { route: 'MCP server', why: why, cautions: ['review which tools the server exposes and turn off write tools you do not need'] }; }
    if (a.hasApi) { why.push('the vendor has an official API'); return { route: 'Official API', why: why, cautions: a.needsLogin ? ['use OAuth or an API key from your own account, stored outside the code'] : [] }; }
    if (a.hasExport) { why.push('no API, but the app exports data on a schedule'); return { route: 'Scheduled export', why: why, cautions: ['read-only: the agent can report on the data but not act in the app'] }; }
    if (a.web && a.authorized) { why.push('web app with no API, used with your own authorized account'); cautions.push('check the terms of service allow automated use'); cautions.push('expect breakage when the page layout changes: add a daily check'); return { route: 'Browser automation', why: why, cautions: cautions }; }
    if (a.desktop && a.authorized && a.licenceAllowsAnalysis) { why.push('desktop software with no API or export, licensed to you, and the licence permits analysis for interoperability'); cautions.push('document behaviour into a spec, then build from the spec in a separate session (clean room)'); cautions.push('no proprietary code copied, no protections bypassed'); return { route: 'Reverse-engineering study (e.g. REA)', why: why, cautions: cautions }; }
    why.push(!a.authorized ? 'no authorized account for this app' : a.desktop && !a.licenceAllowsAnalysis ? 'the licence does not permit analysis' : 'no supported way in');
    return { route: 'Do not automate yet', why: why, cautions: ['ask the vendor for API access, or keep this step manual'] };
  }

  return { DEFAULTS: DEFAULTS, screen: screen, decide: decide, handoffs: handoffs, route: route };
});
