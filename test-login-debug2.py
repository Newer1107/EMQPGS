from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        extra_http_headers={"Origin": "http://localhost:3000"}
    )
    page = context.new_page()
    
    page.on("console", lambda msg: print(f"LOG: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
    page.on("response", lambda resp: print(f"RESP {resp.status}: {resp.url[:80]}") if '/api/' in resp.url else None)
    
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')
    
    print("=== Filling form ===")
    page.fill('input[name="email"]', 'coe@emqpgs.local')
    page.fill('input[name="password"]', 'Password@123')
    
    print("=== Submitting ===")
    try:
        with page.expect_navigation(wait_until='networkidle', timeout=15000):
            page.click('button[type="submit"]')
        print(f"URL after nav: {page.url}")
    except:
        print(f"Navigation timeout. URL: {page.url}")
        page.screenshot(path='login-fail.png', full_page=True)
    
    page.wait_for_timeout(2000)
    print(f"Final URL: {page.url}")
    
    cookies = context.cookies()
    print(f"\nCookies ({len(cookies)}):")
    for c in cookies:
        print(f"  {c['name']}: {c['value'][:50]}")
    
    browser.close()
