/*
 * tests/verify.js: node tests for src/aiEmployee.js (the same file index.html loads).
 * Run: node tests/verify.js      (expects "0 failed" on the last line)
 */
'use strict';
var E = require('../src/aiEmployee.js'), D = require('../data/sample.json');
var passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('PASS: ' + name); } else { failed++; console.log('FAIL: ' + name); } }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
var mem = clone(D.memory), S = E.screen(D.brief, D.candidates, mem);
function r(name, s) { return (s || S).results.filter(function (x) { return x.name === name; })[0]; }

console.log('1. Screening against the brief');
check('8 candidates: 1 shortlist, 3 need approval, 4 rejected, 1 bad row skipped', S.results.length === 8 && S.results.filter(function (x) { return x.decision === 'shortlist'; }).length === 1 && S.queue.length === 3 && S.results.filter(function (x) { return x.decision === 'reject'; }).length === 4 && S.skipped.length === 1);
check('Jordan Ellis: every must-have with evidence, inside salary, shortlisted', r('Jordan Ellis').decision === 'shortlist' && r('Jordan Ellis').evidence.length === 3);
check('Marcus Webb: rejected for missing creator management', r('Marcus Webb').decision === 'reject' && /missing must-have: creator management/.test(r('Marcus Webb').rejects[0]));
check('Ana Torres: 7% over the salary max goes to a person, not rejected', r('Ana Torres').decision === 'needs approval' && /7% over/.test(r('Ana Torres').exceptions[0].text));
check('Dana Lee: 27% over the max is beyond the 15% stretch: rejected', r('Dana Lee').decision === 'reject' && /27% over/.test(r('Dana Lee').rejects[0]));
check('Priya Raman in Austin, willing to relocate: needs approval', r('Priya Raman').decision === 'needs approval' && r('Priya Raman').exceptions[0].type === 'relocation');
check('Leo Martins needs sponsorship the role does not offer: rejected', /sponsorship/.test(r('Leo Martins').rejects[0]));
check('Chloe Park: unknown years and unknown visa are flagged, not guessed', r('Chloe Park').exceptions.map(function (x) { return x.type; }).join() === 'missing-info,visa');
check('Sam Rivera with 3 years against a 4-year minimum: rejected', /3 years, role needs 4/.test(r('Sam Rivera').rejects[0]));
check('nice-to-haves raise the score: Ana (2 of 3) outscores Jordan (1 of 3)', r('Ana Torres').score > r('Jordan Ellis').score);
var b2 = clone(D.brief); b2.remote = true;
check('make the role remote and Priya no longer needs the relocation approval', r('Priya Raman', E.screen(b2, D.candidates, [])).decision === 'shortlist');
check('a brief with no must-haves is refused, not run', E.screen({ title: 'x', mustHave: [] }, D.candidates, []).skipped[0].reason === 'the role brief has no must-have requirements');

console.log('\n2. Approvals and memory');
var ana = S.queue.filter(function (q) { return q.name === 'Ana Torres'; })[0];
check('Ana\'s salary exception cites the earlier approval for Riley Chen', ana.precedent.length === 1 && ana.precedent[0].candidate === 'Riley Chen' && ana.precedent[0].outcome === 'approved');
var chloe = S.queue.filter(function (q) { return q.name === 'Chloe Park'; })[0];
check('Chloe\'s visa question cites the earlier rejection for Tom Ito', chloe.precedent.some(function (p) { return p.candidate === 'Tom Ito'; }));
var d1 = E.decide(S.queue, 'C2', 'approve', mem, 'Victoria', '2026-10-24');
check('approving Ana writes the decision to memory', d1.ok && mem.length === 3 && mem[2].candidate === 'Ana Torres' && mem[2].outcome === 'approved');
check('a second decision on the same person is refused', E.decide(S.queue, 'C2', 'reject', mem).error === 'Ana Torres was already approved');
check('an unknown verdict is refused', E.decide(S.queue, 'C4', 'maybe', mem).ok === false);
var S2 = E.screen(D.brief, D.candidates, mem);
check('next run, the latest salary precedent is Ana Torres', S2.queue.filter(function (q) { return q.name === 'Ana Torres'; })[0].precedent[0].candidate === 'Ana Torres');

console.log('\n3. Handoff to the scheduling agent');
var H = E.handoffs(S, S.queue, D.brief);
check('approved Ana and shortlisted Jordan go to the scheduling agent; nobody else', H.length === 2 && H.map(function (h) { return h.candidate; }).sort().join() === 'Ana Torres,Jordan Ellis');
check('outreach drafts name their real strengths and wait for approval', /brand partnerships and creator management/.test(H[0].draft) && H.every(function (h) { return h.status === 'ready for approval'; }));

console.log('\n4. How to reach each app');
var R = D.apps.map(function (a) { return E.route(a).route; });
check('Gmail and Calendar: official API; Notion and Slack: MCP server', R[0] === 'Official API' && R[1] === 'Official API' && R[2] === 'MCP server' && R[3] === 'MCP server');
check('web portal with no API, own account: browser automation with a terms check', R[4] === 'Browser automation' && E.route(D.apps[4]).cautions.some(function (c) { return /terms of service/.test(c); }));
check('CSV-only platform: scheduled export, read-only', R[5] === 'Scheduled export');
check('licensed desktop app whose licence allows analysis: reverse-engineering study, clean room', R[6] === 'Reverse-engineering study (e.g. REA)' && E.route(D.apps[6]).cautions.some(function (c) { return /clean room/.test(c); }));
check('licence forbids it: do not automate', R[7] === 'Do not automate yet' && /licence does not permit/.test(E.route(D.apps[7]).why[0]));
check('no authorized account: do not automate, even with nothing else available', E.route({ desktop: true, licenceAllowsAnalysis: true }).route === 'Do not automate yet');
check('an API beats reverse-engineering even when both are possible', E.route({ hasApi: true, desktop: true, authorized: true, licenceAllowsAnalysis: true }).route === 'Official API');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
