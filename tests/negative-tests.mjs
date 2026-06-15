// Phase 2: Negative Testing — try to break the system
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
      if (!['Path','Expires','Max-Age','SameSite','Domain','Secure','HttpOnly'].includes(name))
        JAR.set(name, val);
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

async function getDraftingBank() {
  await login('coordinator@emqpgs.local', 'Password@123');
  const subs = await api('GET', '/subjects');
  for (const s of (subs.data?.data || [])) {
    for (const b of (s.questionBanks || [])) {
      if (b.phase === 'DRAFTING' && b.recordStatus === 'ACTIVE') return b.id;
    }
  }
  return null;
}

function o(m) { console.log(`  OK ${m}`); }
function f(m, d) { console.error(`  FAIL ${m}${d ? ': ' + JSON.stringify(d) : ''}`); }
function i(m) { console.log(`  .. ${m}`); }

let passed = 0, failed = 0, total = 0;
function check(label, condition, detail) {
  total++;
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ ${label}${detail ? ': ' + JSON.stringify(detail) : ''}`); }
}

async function main() {
  let bankId, slot0;
  try {
    await login('coe@emqpgs.local', 'Password@123');
    const usrs = (await api('GET', '/users')).data.data;
    const U = {}; for (const u of usrs) U[u.role] = u.id;
    const depts = (await api('GET', '/departments')).data.data;
    const deptId = depts.find(d => d.code === 'CSE')?.id;

    // Find or create a DRAFTING bank for negative tests
    bankId = await getDraftingBank();
    if (!bankId) {
      console.log('No DRAFTING bank — creating one...');
      await login('coordinator@emqpgs.local', 'Password@123');
      const cycId = (await api('GET', '/exam-cycles')).data.data?.[0]?.id;
      const semId = (await api('GET', '/semesters')).data.data?.find(s => s.number === 5)?.id;
      const code = 'NEG' + Date.now().toString(36).slice(-4).toUpperCase();
      const subj = await api('POST', '/subjects', { name:'NegTest', code, departmentId:deptId, semesterId:semId, credits:4 });
      if (subj.status !== 201) { console.log('Cant create subject'); return; }
      await api('POST', `/subjects/${subj.data.data.id}/link-cycle`, { examCycleId: cycId });
      const b = await api('POST', '/question-banks', { subjectId:subj.data.data.id, examCycleId:cycId });
      bankId = b.data.data.id;
      console.log(`Created bank ${bankId}`);
    }
    i(`Bank: ${bankId}`);

    // Get a slot
    const sr = await api('GET', `/question-banks/${bankId}/slots`);
    const slots = Array.isArray(sr.data.data) ? sr.data.data : sr.data.data.slots || [];
    slot0 = slots.find(s => s.assignedQuestionId != null) || slots[0];

    // === TEST 1: Contributor assigns slots (contributor CAN assign per API docs) ===
    console.log('\n=== Test 1: Contributor assigns slots ===');
    await login('contributor@emqpgs.local', 'Password@123');
    const asgn = await api('PATCH', `/question-banks/${bankId}/slots/${slot0?.id}`, { questionId: slot0?.assignedQuestionId || 'x' });
    // 403 = forbidden (wrong), anything else = endpoint responds (right). x is invalid Q, expect 4xx
    check('Contributor slot assign endpoint accessible', asgn.status !== 403, asgn.data?.error);

    // === TEST 2: Moderator advances phases ===
    console.log('\n=== Test 2: Moderator advances phases ===');
    await login('moderator@emqpgs.local', 'Password@123');
    const adv = await api('PATCH', `/question-banks/${bankId}/advance`, { targetPhase: 'MODERATION' });
    check('Moderator cannot advance phase (403)', adv.status === 403, adv.data?.error);

    // === TEST 3: Dean advances phases ===
    console.log('\n=== Test 3: Dean advances phases ===');
    await login('dean@emqpgs.local', 'Password@123');
    const adv2 = await api('PATCH', `/question-banks/${bankId}/advance`, { targetPhase: 'MODERATION' });
    check('Dean cannot advance phase (403)', adv2.status === 403, adv2.data?.error);

    // === TEST 4: Contributor tries coordinator-decision ===
    console.log('\n=== Test 4: Contributor tries coordinator decision ===');
    await login('contributor@emqpgs.local', 'Password@123');
    const dec = await api('POST', `/question-banks/${bankId}/coordinator-decision`, { decision:'APPROVED', remark:'test' });
    check('Contributor cannot make coordinator decision', dec.status === 403, dec.data?.error);

    // === TEST 5: Moderator tries coordinator-decision ===
    console.log('\n=== Test 5: Moderator tries coordinator-decision ===');
    await login('moderator@emqpgs.local', 'Password@123');
    const dec2 = await api('POST', `/question-banks/${bankId}/coordinator-decision`, { decision:'APPROVED', remark:'test' });
    check('Moderator cannot make coordinator decision', dec2.status === 403, dec2.data?.error);

    // === TEST 6: Lock bank then try mutations ===
    console.log('\n=== Test 6: Lock guard ===');
    await login('coordinator@emqpgs.local', 'Password@123');
    await api('PATCH', `/question-banks/${bankId}/lock`, {});
    // After lock
    const lAdv = await api('PATCH', `/question-banks/${bankId}/advance`, { targetPhase:'MODERATION' });
    check('Phase advance blocked on LOCKED', lAdv.status === 409 || lAdv.status === 400, lAdv.data?.error);
    const lSl = await api('PATCH', `/question-banks/${bankId}/slots/${slot0?.id}`, { questionId: 'x' });
    check('Slot assign blocked on LOCKED', lSl.status === 409 || lSl.status === 403, lSl.data?.error);
    // Unlock after test
    await api('POST', `/question-banks/${bankId}/unlock`, {});

    // === TEST 7: Invalid phase transitions ===
    console.log('\n=== Test 7: Invalid phase transitions ===');
    const invalidTransitions = [
      { from: 'DRAFTING', to: 'COMPLETE' },
      { from: 'MODERATION', to: 'DRAFTING' },
      { from: 'APPROVAL', to: 'DRAFTING' },
      { from: 'COMPLETE', to: 'MODERATION' },
    ];
    for (const t of invalidTransitions) {
      // Need bank in correct phase — test is structural via transitions.ts
      // For now, test COMPLETE → any since we have banks in COMPLETE
      if (t.from === 'COMPLETE') {
        const compBank = (await api('GET', '/subjects')).data.data
          ?.flatMap(s => s.questionBanks || [])
          ?.find(b => b.phase === 'COMPLETE')?.id;
        if (compBank) {
          const r = await api('PATCH', `/question-banks/${compBank}/advance`, { targetPhase: t.to });
          check(`Cannot advance ${t.from}→${t.to}`, r.status !== 200, r.data?.error);
        }
      }
    }

    // === TEST 8: Unauthenticated access ===
    console.log('\n=== Test 8: Unauthenticated access ===');
    // Clear cookies
    JAR.clear();
    const unauth = await api('GET', '/departments');
    check('Unauthenticated GET blocked', unauth.status === 401, unauth.data?.error);
    const unauth2 = await api('POST', '/question-banks', { subjectId:'x', examCycleId:'x' });
    check('Unauthenticated POST blocked', unauth2.status === 401, unauth2.data?.error);

    // === TEST 9: Lock bank, then paper generation ===
    console.log('\n=== Test 9: Locked bank paper generation ===');
    await login('coordinator@emqpgs.local', 'Password@123');
    await api('PATCH', `/question-banks/${bankId}/lock`, {});
    const papers = await api('POST', `/question-banks/${bankId}/papers`, { variantCount: 3 });
    check('Paper generation blocked on LOCKED', papers.status !== 200, papers.data?.error);
    await api('POST', `/question-banks/${bankId}/unlock`, {});

    // === TEST 10: RBAC — wrong role endpoints ===
    console.log('\n=== Test 10: Wrong role access ===');
    await login('contributor@emqpgs.local', 'Password@123');
    const users = await api('GET', '/users');
    check('Contributor cannot list users', users.status === 403, users.data?.error);
    const ec = await api('GET', '/exam-cycles');
    check('Contributor cannot list exam cycles', ec.status === 403, ec.data?.error);

  } catch(e) { console.error(`\nUNEXPECTED: ${e.stack || e.message}`); }

  console.log(`\n=== NEGATIVE TEST SUMMARY: ${passed} passed, ${failed} failed of ${total} ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
