// Debug CSRF flow
const BASE = 'http://localhost:3000/api';
const COOKIE_JAR = new Map();

async function fetchAndDebug(label, method, path, body = undefined) {
  const url = `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  const cookieParts = [];
  for (const [k, v] of COOKIE_JAR.entries()) cookieParts.push(`${k}=${v}`);
  if (cookieParts.length) headers['Cookie'] = cookieParts.join('; ');

  console.log(`\n--- ${label} ---`);
  console.log(`Request: ${method} ${url}`);
  console.log(`Cookies sent: ${cookieParts.length ? cookieParts.join('; ') : '(none)'}`);

  const opts = { method, headers, redirect: 'manual' };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);

  console.log(`Status: ${res.status}`);
  
  // Dump all response headers
  const allHeaders = {};
  for (const [k, v] of res.headers.entries()) allHeaders[k] = v;
  console.log(`Response headers:`, JSON.stringify(allHeaders, null, 2));

  // Capture set-cookie
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    console.log(`Set-Cookie raw: ${setCookie}`);
    for (const part of setCookie.split(',')) {
      const m = part.match(/^([^=]+)=([^;]+)/);
      if (m) {
        COOKIE_JAR.set(m[1], m[2]);
        console.log(`  Cookie stored: ${m[1]} = ${m[2]}`);
      }
    }
  } else {
    console.log('No Set-Cookie header');
  }

  // Dump cookie jar
  console.log(`Cookie jar now:`, Object.fromEntries(COOKIE_JAR.entries()));

  let data;
  try { data = await res.json(); } catch { data = null; }
  console.log(`Body:`, JSON.stringify(data, null, 2));

  return { status: res.status, data, headers: res.headers };
}

async function main() {
  // 1. Try CSRF endpoint
  await fetchAndDebug('GET /auth/csrf', 'GET', '/auth/csrf');

  // 2. Try login with CSRF
  const csrfToken = COOKIE_JAR.get('emqpgs_csrf_token');
  const res = await fetchAndDebug('POST /auth/login', 'POST', '/auth/login', {
    email: 'coe@emqpgs.local',
    password: 'Password@123',
  });

  // 3. Try a GET request with cookies
  if (res.status === 200) {
    await fetchAndDebug('GET /departments', 'GET', '/departments');
  }
}

main().catch(console.error);
