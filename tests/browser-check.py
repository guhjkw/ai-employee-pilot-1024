"""
tests/browser-check.py
Playwright checks that drive the real page (index.html), which loads the
same src/aiEmployee.js that tests/verify.js tests.
Run:  python3 tests/browser-check.py      (expects "0 failed" on the last line)
"""
import functools, http.server, pathlib, threading
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
TESTS = ROOT / "tests"
passed = failed = 0
def check(name, cond):
    global passed, failed
    if cond: passed += 1; print(f"PASS: {name}")
    else: failed += 1; print(f"FAIL: {name}")

class Balance(HTMLParser):
    VOID = {"meta","link","br","input","img","hr","source","wbr","col"}
    def __init__(self): super().__init__(); self.stack, self.errors = [], []
    def handle_starttag(self, tag, attrs):
        if tag not in self.VOID: self.stack.append(tag)
    def handle_endtag(self, tag):
        if tag in self.VOID: return
        if not self.stack or self.stack[-1] != tag: self.errors.append(f"unexpected </{tag}> open {self.stack[-3:]}")
        else: self.stack.pop()

print("0. HTML tag balance")
b = Balance(); b.feed((ROOT / "index.html").read_text())
check("all tags closed and nested", not b.errors and not b.stack)
if b.errors: print(b.errors[:5])

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT)); handler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler); threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
problems = []

with sync_playwright() as pw:
    br = pw.chromium.launch()
    p = br.new_page(viewport={"width": 1366, "height": 950})
    p.on("console", lambda m: problems.append(m.text) if m.type == "error" else None)
    p.on("pageerror", lambda e: problems.append(str(e)))
    p.goto(url); p.wait_for_selector("[data-testid=cand-C1]")
    txt = lambda t: p.locator(f"[data-testid={t}]").first.text_content()
    dec = lambda c: p.get_attribute(f"[data-testid=cand-{c}]", "data-dec")

    print("1. Sample screen")
    check("1 shortlist, 3 to you, 4 rejected", txt("counts") == "1 shortlist · 3 to you · 4 rejected")
    check("Ana's salary question cites the earlier Riley Chen approval", "Last time: you approved Riley Chen" in txt("q-C2"))
    check("only Jordan is handed to scheduling at first", p.locator("[data-testid=ho-item]").count() == 1 and "Jordan Ellis" in txt("ho"))
    p.screenshot(path=str(TESTS / "screenshot-default.png"), full_page=False)

    print("\n2. Decisions")
    p.click("[data-testid=ap-C2]")
    check("approve Ana: she is handed to scheduling and remembered", p.locator("[data-testid=ho-item]").count() == 2 and dec("C2") == "approved by you" and "approved Ana Torres" in txt("mem"))
    p.click("[data-testid=rj-C6]")
    check("reject Chloe: remembered, not handed off", dec("C6") == "rejected by you" and "rejected Chloe Park" in txt("mem") and "Chloe" not in txt("ho"))
    check("waiting count drops to 1", txt("qn") == "1 waiting")

    print("\n3. Change the brief")
    p.check("[data-testid=b-remote]")
    check("Remote OK: Priya no longer needs approval", dec("C4") == "shortlist")
    p.fill("[data-testid=b-must]", "brand partnerships, creator management, negotiation, Spanish")
    check("add Spanish as a must-have: Jordan is rejected for missing it", dec("C1") == "reject" and "missing must-have: Spanish" in txt("cand-C1"))
    p.fill("[data-testid=b-must]", "brand partnerships, creator management, negotiation"); p.fill("[data-testid=b-sal]", "145000")
    check("salary max 145,000: Dana comes back", dec("C8") != "reject")
    p.fill("[data-testid=b-must]", "")
    check("an empty must-have list is refused with the reason", "no must-have requirements" in txt("skipped"))
    p.click("[data-testid=reset]")
    check("reset restores the sample", txt("counts") == "1 shortlist · 3 to you · 4 rejected" and txt("qn") == "3 waiting")

    print("\n4. Integration routes")
    check("Notion and Slack via MCP, Gmail via API", txt("route-2") == "MCP server" and txt("route-3") == "MCP server" and txt("route-0") == "Official API")
    check("licensed desktop CRM with analysis allowed: reverse-engineering study", txt("route-6") == "Reverse-engineering study (e.g. REA)")
    p.uncheck("[data-testid=ck-6-licenceAllowsAnalysis]")
    check("untick the licence: the route becomes do not automate", txt("route-6") == "Do not automate yet")
    p.check("[data-testid=ck-7-hasApi]")
    check("give the brand deal tracker an API: official API wins", txt("route-7") == "Official API")
    p.locator("#app").scroll_into_view_if_needed()
    p.screenshot(path=str(TESTS / "screenshot-app.png"), full_page=False)

    print("\n5. Phone width")
    m = br.new_page(viewport={"width": 390, "height": 844})
    m.on("pageerror", lambda e: problems.append(str(e)))
    m.goto(url); m.wait_for_selector("[data-testid=cand-C1]")
    check("no horizontal page scroll at 390px", m.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"))
    m.locator("#app").scroll_into_view_if_needed(); m.screenshot(path=str(TESTS / "screenshot-mobile.png"), full_page=False)

    print("\n6. Off disk (file://, fallback data)")
    f = br.new_page(); f.on("pageerror", lambda e: problems.append(str(e)))
    f.goto((ROOT / "index.html").as_uri()); f.wait_for_selector("[data-testid=cand-C1]")
    check("file:// copy works on the embedded data", f.locator("[data-testid=cands] tr").count() == 8)

    print("\n7. Console")
    check("zero console or page errors", not [x for x in problems if "Failed to fetch" not in x and "ERR_FILE" not in x and "CORS" not in x])
    if problems: print(problems)
    br.close()
srv.shutdown()
print(f"\n{passed} passed, {failed} failed")
