from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Capture console logs
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')
    
    print("=== Filling login form ===")
    page.fill('input[name="email"]', 'coe@emqpgs.local')
    page.fill('input[name="password"]', 'Password@123')
    
    # Listen for response
    with page.expect_response(lambda r: r.url.endswith('/api/auth/login')) as response_info:
        page.click('button[type="submit"]')
        response = response_info.value
    
    print(f"Login response status: {response.status}")
    print(f"Login response body: {response.text()}")
    
    page.wait_for_timeout(2000)
    print(f"URL after login: {page.url}")
    page.screenshot(path='recon-after-login.png', full_page=True)
    
    # Check cookies
    cookies = page.context.cookies()
    print(f"\nCookies after login ({len(cookies)}):")
    for c in cookies:
        print(f"  {c['name']}: {c['value'][:30]}...")
    
    browser.close()
