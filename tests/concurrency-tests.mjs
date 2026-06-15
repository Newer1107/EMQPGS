// Phase 3: Concurrency Testing — race conditions
const BASE = 'http://localhost:3000/api';
const JAR = new Map();

async function api(method, path, body) {
  const h = {'Content-Type':'application/json'};
  const CA = [...JAR.entries()].map(([k,v])=>`${k}=${v}`).join('; ');
  if (CA) h.Cookie = CA;
  if (!['GET','HEAD','OPTIONS'].includes(method) && JAR.has('emqpgs_csrf_token'))
    h['x-csrf-token'] = JAR.get('emqpgs_csrf_token');
  const o = { method, headers: h, redirect: 'manual' };
  if (body !== undefined) o.body = JSON.stringify(body);
  const r = await fetch(BASE + path, o);
  const sc = r.headers.get('set-cookie');
  if (sc) {
    for (const part of sc.split(/,\s*(?=[a-z])/i)) {
      const eq = part.indexOf('='); if (eq <= 0) continue;
      const semi = part.indexOf(';', eq);
      const name = part.substring(0, eq).trim();
      const val = part.substring(eq + 1, semi > 0 ? semi : undefined).trim();
      if (!['Path','Expires','Max-Age','SameSite','Domain','Secure','HttpOnly'].includes(name)) JAR.set(name, val);
    }
  }
  let data; try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
}

async function login(email, pw) {
  await api('GET', '/auth/csrf');
  const r = await api('POST', '/auth/login', { email, password: pw });
  if (r.status !== 200) throw new Error(`Login fail ${email}`);
  if (!JAR.has('emqpgs_csrf_token')) await api('GET', '/auth/csrf');
  return r.data?.data?.user;
}

let passed = 0, failed = 0, total = 0;
function check(label, condition, detail) {
  total++;
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ ${label}${detail ? ': ' + JSON.stringify(detail) : ''}`); }
}
function i(m) { console.log(`  .. ${m}`); }

async function main() {
  try {
    // Use the only DRAFTING bank
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const bank = await prisma.questionBank.findFirst({ where: { phase: 'DRAFTING', recordStatus: 'ACTIVE' } });
    if (!bank) { console.log('No DRAFTING bank'); return; }
    const bankId = bank.id;

    // Find two empty slots
    const slots = await prisma.questionSlot.findMany({
      where: { questionBankId: bankId, assignedQuestionId: null },
      take: 2
    });
    
    // Find two questions from another bank (we just need IDs)
    const questions = await prisma.questionLibraryItem.findMany({ take: 2 });
    await prisma.$disconnect();

    i(`Bank: ${bankId}, slots: ${slots.length}, questions: ${questions.length}`);

    // === TEST 1: Optimistic locking — two simultaneous slot assigns ===
    console.log('\n=== Concurrency Test 1: Simultaneous slot assignment ===');
    if (slots.length >= 1 && questions.length >= 2) {
      const slotId = slots[0].id;
      const q1 = questions[0].id;
      const q2 = questions[1].id;

      // Create two independent sessions
      const J1 = new Map(), J2 = new Map();

      // Clone the api function for J1
      async function api1(m, p, b) {
        const h = {'Content-Type':'application/json'};
        const CA = [...J1.entries()].map(([k,v])=>`${k}=${v}`).join('; ');
        if (CA) h.Cookie = CA;
        if (!['GET','HEAD','OPTIONS'].includes(m) && J1.has('emqpgs_csrf_token')) h['x-csrf-token'] = J1.get('emqpgs_csrf_token');
        const o = { method: m, headers: h, redirect: 'manual' };
        if (b !== undefined) o.body = JSON.stringify(b);
        const r = await fetch(BASE + p, o);
        const sc = r.headers.get('set-cookie');
        if (sc) { for (const part of sc.split(/,\s*(?=[a-z])/i)) { const eq = part.indexOf('='); if (eq>0) { const semi = part.indexOf(';', eq); const n = part.substring(0, eq).trim(); const v = part.substring(eq+1, semi>0?semi:undefined).trim(); if (!['Path','Expires','Max-Age','SameSite','Domain','Secure','HttpOnly'].includes(n)) J1.set(n,v); } } }
        let d; try { d = await r.json(); } catch { d = null; }
        return { status: r.status, data: d };
      }

      async function api2(m, p, b) {
        const h = {'Content-Type':'application/json'};
        const CA = [...J2.entries()].map(([k,v])=>`${k}=${v}`).join('; ');
        if (CA) h.Cookie = CA;
        if (!['GET','HEAD','OPTIONS'].includes(m) && J2.has('emqpgs_csrf_token')) h['x-csrf-token'] = J2.get('emqpgs_csrf_token');
        const o = { method: m, headers: h, redirect: 'manual' };
        if (b !== undefined) o.body = JSON.stringify(b);
        const r = await fetch(BASE + p, o);
        const sc = r.headers.get('set-cookie');
        if (sc) { for (const part of sc.split(/,\s*(?=[a-z])/i)) { const eq = part.indexOf('='); if (eq>0) { const semi = part.indexOf(';', eq); const n = part.substring(0, eq).trim(); const v = part.substring(eq+1, semi>0?semi:undefined).trim(); if (!['Path','Expires','Max-Age','SameSite','Domain','Secure','HttpOnly'].includes(n)) J2.set(n,v); } } }
        let d; try { d = await r.json(); } catch { d = null; }
        return { status: r.status, data: d };
      }

      // Login both sessions
      await api1('GET', '/auth/csrf'); await api1('POST', '/auth/login', { email:'coordinator@emqpgs.local', password:'Password@123' });
      await api2('GET', '/auth/csrf'); await api2('POST', '/auth/login', { email:'coordinator@emqpgs.local', password:'Password@123' });

      // Fire both simultaneously
      const [r1, r2] = await Promise.all([
        api1('PATCH', `/question-banks/${bankId}/slots/${slotId}`, { questionId: q1 }),
        api2('PATCH', `/question-banks/${bankId}/slots/${slotId}`, { questionId: q2 }),
      ]);

      i(`Session 1: ${r1.status} — ${r1.data?.error?.code || 'OK'}`);
      i(`Session 2: ${r2.status} — ${r2.data?.error?.code || 'OK'}`);
      check('At most one assignment succeeds', (r1.status === 200) !== (r2.status === 200) || (r1.status !== 200 && r2.status !== 200), { r1: r1.data?.error, r2: r2.data?.error });
    } else { i('Not enough slots/questions for concurrency test'); }

    // === TEST 2: Simultaneous phase advance ===
    console.log('\n=== Concurrency Test 2: Simultaneous phase advance ===');
    const J3 = new Map(), J4 = new Map();

    async function api3(m, p, b) {
      const h = {'Content-Type':'application/json'};
      const CA = [...J3.entries()].map(([k,v])=>`${k}=${v}`).join('; ');
      if (CA) h.Cookie = CA;
      if (!['GET','HEAD','OPTIONS'].includes(m) && J3.has('emqpgs_csrf_token')) h['x-csrf-token'] = J3.get('emqpgs_csrf_token');
      const o = { method: m, headers: h, redirect: 'manual' };
      if (b !== undefined) o.body = JSON.stringify(b);
      const r = await fetch(BASE + p, o);
      const sc = r.headers.get('set-cookie');
      if (sc) { for (const part of sc.split(/,\s*(?=[a-z])/i)) { const eq = part.indexOf('='); if (eq>0) { const semi = part.indexOf(';', eq); const n = part.substring(0, eq).trim(); const v = part.substring(eq+1, semi>0?semi:undefined).trim(); if (!['Path','Expires','Max-Age','SameSite','Domain','Secure','HttpOnly'].includes(n)) J3.set(n,v); } } }
      let d; try { d = await r.json(); } catch { d = null; }
      return { status: r.status, data: d };
    }

    async function api4(m, p, b) {
      const h = {'Content-Type':'application/json'};
      const CA = [...J4.entries()].map(([k,v])=>`${k}=${v}`).join('; ');
      if (CA) h.Cookie = CA;
      if (!['GET','HEAD','OPTIONS'].includes(m) && J4.has('emqpgs_csrf_token')) h['x-csrf-token'] = J4.get('emqpgs_csrf_token');
      const o = { method: m, headers: h, redirect: 'manual' };
      if (b !== undefined) o.body = JSON.stringify(b);
      const r = await fetch(BASE + p, o);
      const sc = r.headers.get('set-cookie');
      if (sc) { for (const part of sc.split(/,\s*(?=[a-z])/i)) { const eq = part.indexOf('='); if (eq>0) { const semi = part.indexOf(';', eq); const n = part.substring(0, eq).trim(); const v = part.substring(eq+1, semi>0?semi:undefined).trim(); if (!['Path','Expires','Max-Age','SameSite','Domain','Secure','HttpOnly'].includes(n)) J4.set(n,v); } } }
      let d; try { d = await r.json(); } catch { d = null; }
      return { status: r.status, data: d };
    }

    // Login as coordinator
    await api3('GET', '/auth/csrf'); await api3('POST', '/auth/login', { email:'coordinator@emqpgs.local', password:'Password@123' });
    await api4('GET', '/auth/csrf'); await api4('POST', '/auth/login', { email:'coordinator@emqpgs.local', password:'Password@123' });

    // Fire both simultaneously
    const [r3, r4] = await Promise.all([
      api3('PATCH', `/question-banks/${bankId}/advance`, { targetPhase: 'MODERATION' }),
      api4('PATCH', `/question-banks/${bankId}/advance`, { targetPhase: 'MODERATION' }),
    ]);

    i(`Session 3: ${r3.status} — ${r3.data?.error?.code || 'OK'}`);
    i(`Session 4: ${r4.status} — ${r4.data?.error?.code || 'OK'}`);
    // One should succeed, one should be a version conflict
    check('No double advance occurs', !(r3.status === 200 && r4.status === 200), { r3: r3.data?.error, r4: r4.data?.error });

    // === TEST 3: Lock/unlock race ===
    console.log('\n=== Concurrency Test 3: Simultaneous lock and unlock ===');
    const J5 = new Map(), J6 = new Map();

    async function api5(m, p, b) {
      const h = {'Content-Type':'application/json'};
      const CA = [...J5.entries()].map(([k,v])=>`${k}=${v}`).join('; ');
      if (CA) h.Cookie = CA;
      if (!['GET','HEAD','OPTIONS'].includes(m) && J5.has('emqpgs_csrf_token')) h['x-csrf-token'] = J5.get('emqpgs_csrf_token');
      const o = { method: m, headers: h, redirect: 'manual' };
      if (b !== undefined) o.body = JSON.stringify(b);
      const r = await fetch(BASE + p, o);
      const sc = r.headers.get('set-cookie');
      if (sc) { for (const part of sc.split(/,\s*(?=[a-z])/i)) { const eq = part.indexOf('='); if (eq>0) { const semi = part.indexOf(';', eq); const n = part.substring(0, eq).trim(); const v = part.substring(eq+1, semi>0?semi:undefined).trim(); if (!['Path','Expires','Max-Age','SameSite','Domain','Secure','HttpOnly'].includes(n)) J5.set(n,v); } } }
      let d; try { d = await r.json(); } catch { d = null; }
      return { status: r.status, data: d };
    }

    async function api6(m, p, b) {
      const h = {'Content-Type':'application/json'};
      const CA = [...J6.entries()].map(([k,v])=>`${k}=${v}`).join('; ');
      if (CA) h.Cookie = CA;
      if (!['GET','HEAD','OPTIONS'].includes(m) && J6.has('emqpgs_csrf_token')) h['x-csrf-token'] = J6.get('emqpgs_csrf_token');
      const o = { method: m, headers: h, redirect: 'manual' };
      if (b !== undefined) o.body = JSON.stringify(b);
      const r = await fetch(BASE + p, o);
      const sc = r.headers.get('set-cookie');
      if (sc) { for (const part of sc.split(/,\s*(?=[a-z])/i)) { const eq = part.indexOf('='); if (eq>0) { const semi = part.indexOf(';', eq); const n = part.substring(0, eq).trim(); const v = part.substring(eq+1, semi>0?semi:undefined).trim(); if (!['Path','Expires','Max-Age','SameSite','Domain','Secure','HttpOnly'].includes(n)) J6.set(n,v); } } }
      let d; try { d = await r.json(); } catch { d = null; }
      return { status: r.status, data: d };
    }

    await api5('GET', '/auth/csrf'); await api5('POST', '/auth/login', { email:'coordinator@emqpgs.local', password:'Password@123' });
    await api6('GET', '/auth/csrf'); await api6('POST', '/auth/login', { email:'coordinator@emqpgs.local', password:'Password@123' });

    const [r5, r6] = await Promise.all([
      api5('PATCH', `/question-banks/${bankId}/lock`, {}),
      api6('POST', `/question-banks/${bankId}/unlock`, {}),
    ]);

    i(`Lock: ${r5.status} — ${r5.data?.error?.code || 'OK'}`);
    i(`Unlock: ${r6.status} — ${r6.data?.error?.code || 'OK'}`);
    // Either order should be handled gracefully
    check('Lock/unlock race handled gracefully', r5.status !== 500 && r6.status !== 500, { lock: r5.data?.error, unlock: r6.data?.error });

    // Clean up: unlock if locked
    const J7 = new Map();
    await (async () => {
      const h = {'Content-Type':'application/json'};
      const o = { method: 'POST', headers: h, redirect: 'manual', body: '{}' };
      await api6('GET', '/auth/csrf'); await api6('POST', '/auth/login', { email:'coordinator@emqpgs.local', password:'Password@123' });
      if (J6.has('emqpgs_csrf_token')) h['x-csrf-token'] = J6.get('emqpgs_csrf_token');
      await fetch(BASE + `/question-banks/${bankId}/unlock`, { ...o, headers: { ...h } });
    })();

  } catch(e) { console.error(`\nUNEXPECTED: ${e.stack || e.message}`); }

  console.log(`\n=== CONCURRENCY TEST SUMMARY: ${passed} passed, ${failed} failed of ${total} ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
