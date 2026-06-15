"""Direct API test - bypass browser CSRF by setting origin"""
from playwright.sync_api import sync_playwright

AUTH_URL = "http://devenv.tcetcercd.in"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        extra_http_headers={"Origin": AUTH_URL}
    )
    page = context.new_page()
    
    page.on("response", lambda resp: print(f"{resp.status} {resp.url[:90]}") if resp.url.find('/api/') >= 0 else None)
    
    print("=== 1. Get CSRF token ===")
    csrf_resp = page.goto(f"{AUTH_URL}/api/auth/csrf")
    csrf_body = csrf_resp.json()
    csrf_token = csrf_body.get('data', {}).get('csrfToken')
    print(f"CSRF token: {csrf_token[:40] if csrf_token else 'None'}...")
    
    # Get the cookie
    cookies = context.cookies()
    for c in cookies:
        print(f"Cookie: {c['name']}={c['value'][:40]}...")
    
    print("\n=== 2. Login ===")
    login_resp = page.evaluate("""
        async () => {
            const resp = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': document.cookie.match(/emqpgs_csrf_token=([^;]+)/)?.[1] || ''
                },
                body: JSON.stringify({ email: 'coe@emqpgs.local', password: 'Password@123' }),
                credentials: 'same-origin'
            });
            return { status: resp.status, body: await resp.json() };
        }
    """)
    print(f"Login: {login_resp['status']}")
    if login_resp['status'] == 200:
        print("SUCCESS - logged in!")
    else:
        print(f"FAILED: {login_resp['body']}")
    
    browser.close()
