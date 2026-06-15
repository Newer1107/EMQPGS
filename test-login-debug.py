from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page.on("console", lambda msg: print(f"LOG: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
    page.on("response", lambda resp: print(f"RESP {resp.status}: {resp.url[:80]}") if '/api/' in resp.url else None)
    
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    
    print("=== Filling form ===")
    page.fill('input[name="email"]', 'coe@emqpgs.local')
    page.fill('input[name="password"]', 'Password@123')
    
    print("=== Submitting ===")
    with page.expect_navigation(wait_until='networkidle', timeout=10000):
        page.click('button[type="submit"]')
    
    print(f"URL after submit: {page.url}")
    page.wait_for_timeout(2000)
    print(f"Final URL: {page.url}")
    page.screenshot(path='login-result.png', full_page=True)
    
    cookies = page.context.cookies()
    print(f"\nCookies ({len(cookies)}):")
    for c in cookies:
        print(f"  {c['name']}: {c['value'][:50]}")
    
    if page.url != 'http://localhost:3000/login':
        print("\n=== Checking sidebar ===")
        links = page.query_selector_all('nav a')
        for link in links:
            print(f"  {link.inner_text().strip():30s} -> {link.get_attribute('href')}")
    
    browser.close()
