# AI Employee Pilot (preview)

A working preview of one AI employee for recruiting / creator-agency work: candidates screened against a role brief with evidence per requirement; judgement calls (salary stretch, relocation, unknown work status, missing information) sent to a person with the last similar decision cited; decisions written to memory; approved candidates handed to a scheduling agent with outreach drafts awaiting approval. Plus an integration rule for how an AI employee should reach each app (MCP, API, export, browser automation, a licensed reverse-engineering study, or not at all).

Live: https://guhjkw.github.io/ai-employee-pilot-1024/

## Files
```
index.html               the interface
src/aiEmployee.js        screen(), decide(), handoffs(), route()
data/sample.json         invented role brief, candidates, past decisions, apps
tests/verify.js          27 node tests
tests/browser-check.py   19 Playwright checks
```
The page and the tests load the same `src/aiEmployee.js`.

## Run the tests
```
node tests/verify.js            # 27 passed, 0 failed
python3 tests/browser-check.py  # 19 passed, 0 failed
```

## Rules
| Area | Rule |
|---|---|
| Reject | A missing must-have, under the minimum years, on-site role elsewhere without relocation, salary over max by more than 15%, sponsorship needed but not offered |
| Ask a person | Salary up to 15% over, willing to relocate, years or salary not stated, work authorization unknown, no email |
| Precedent | The most recent decision on the same exception type is shown with the question |
| Memory | Every approve/reject is stored per exception type; a decision cannot be made twice |
| Handoff | Shortlisted and approved candidates go to the scheduling agent; drafts wait for approval |
| Routes | MCP, then official API, then scheduled export, then browser automation with an authorized account, then a reverse-engineering study only for licensed desktop software whose licence permits analysis; otherwise do not automate |

No REA experience is claimed. The tool calls in the run log are simulated.

Built by Taiwo, Pathfinder Automation Solutions.
