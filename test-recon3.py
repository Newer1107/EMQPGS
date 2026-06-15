from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--disable-web-security'])
    context = browser.new_context(
        extra_http_headers={"Origin": "http://localhost:3000"}
    )
    page = context.new_page()
    
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.on("response", lambda resp: print(f"RESP {resp.status}: {resp.url[:80]}") if resp.url.find('/api/') >= 0 else None)
    
    print("=== Login ===")
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')
    
    page.fill('input[name="email"]', 'coe@emqpgs.local')
    page.fill('input[name="password"]', 'Password@123')
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)
    print(f"URL: {page.url}")
    
    cookies = context.cookies()
    for c in cookies:
        print(f"  Cookie: {c['name']}={c['value'][:40]}...")
    
    # Try direct navigation
    print("\n=== Navigate to /dashboard ===")
    page.goto('http://localhost:3000/dashboard')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    print(f"URL: {page.url}")
    page.screenshot(path='recon-dashboard.png', full_page=True)
    
    # Check for role cards
    cards = page.query_selector_all('a[href*="/dashboard/"]')
    print("\nDashboard links:")
    for card in cards:
        href = card.get_attribute('href')
        if href and href != '/dashboard':
            print(f"  {card.inner_text().strip()[:50]:50s} -> {href}")
    
    browser.close()
