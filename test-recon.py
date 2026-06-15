from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    print("=== RECON: Login Page ===")
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='recon-login.png', full_page=True)
    
    form = page.query_selector('form')
    if form:
        inputs = form.query_selector_all('input, button')
        for el in inputs:
            print(f"  Tag: {el.evaluate('e => e.tagName')} Type: {el.get_attribute('type')} Name: {el.get_attribute('name')} Placeholder: {el.get_attribute('placeholder')} Text: {el.inner_text()[:40] if el.inner_text() else 'N/A'}")
    
    print("\n=== RECON: Login as COE ===")
    page.fill('input[name="email"]', 'coe@emqpgs.local')
    page.fill('input[name="password"]', 'Password@123')
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)
    print(f"URL after login: {page.url}")
    page.screenshot(path='recon-after-login.png', full_page=True)
    
    # Try navigating directly
    print("\n=== RECON: Direct Navigation ===")
    page.goto('http://localhost:3000/dashboard/coe')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    print(f"URL at /dashboard/coe: {page.url}")
    page.screenshot(path='recon-coe-dashboard.png', full_page=True)
    
    # Check sidebar links
    sidebar_links = page.query_selector_all('nav a')
    print("\nSidebar links:")
    for link in sidebar_links:
        print(f"  {link.inner_text().strip():30s} -> {link.get_attribute('href')}")
    
    browser.close()
    print("\nRecon complete.")
