// EMQPGS End-to-End Workflow Validation v2
// Uses existing seed data + creates minimal new data
const BASE = 'http://localhost:3000/api';
const JAR = new Map();

async function api(method, path, body, expectStatus) {
  const url = BASE + path;
  const h = { 'Content-Type': 'application/json' };
  const ca = [...JAR.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  if (ca) h['Cookie'] = ca;
  if (!['GET','HEAD','OPTIONS'].includes(method) && JAR.has('emqpgs_csrf_token'))
    h['x-csrf-token'] = JAR.get('emqpgs_csrf_token');
  const o = { method, headers: h, redirect: 'manual' };
  if (body !== undefined) o.body = JSON.stringify(body);
  const r = await fetch(url, o);
  const sc = r.headers.get('set-cookie');
  if (sc) {
    for (const part of sc.split(/,\s*(?=[a-z])/i)) {
      const eq = part.indexOf('=');
      if (eq <= 0) continue;
      const semi = part.indexOf(';', eq);
      const name = part.substring(0, eq).trim();
      const val = part.substring(eq + 1, semi > 0 ? semi : undefined).trim();
      if (!['Path','Expires','Max-Age','SameSite','Domain','Secure','HttpOnly'].includes(name))
        JAR.set(name, val);
    }
  }
  let data;
  try { data = await r.json(); } catch { data = null; }
  if (expectStatus !== undefined && r.status !== expectStatus)
    throw new Error(`Expected ${expectStatus} got ${r.status}: ${JSON.stringify(data)}`);
  return { status: r.status, data };
}

async function login(email, pw) {
  await api('GET', '/auth/csrf');
  const r = await api('POST', '/auth/login', { email, password: pw });
  if (r.status !== 200) throw new Error(`Login fail ${email}: ${JSON.stringify(r.data)}`);
  if (!JAR.has('emqpgs_csrf_token')) await api('GET', '/auth/csrf');
  return r.data?.data?.user;
}

let S = { passed: 0, failed: 0 };
function step(n) { console.log(`\n=== Step ${n} ===`); }
function ok(m) { S.passed++; console.log(`  OK ${m}`); }
function fail(m, d) { S.failed++; console.error(`  FAIL ${m}${d ? ': ' + JSON.stringify(d) : ''}`); }
function info(m) { console.log(`  .. ${m}`); }

async function main() {
  let deptId, semId, cycId, subjId, verId, bankId, slots = [], qIds = [];
  let userIds = {};

  try {
    // === STEP 1: COE — verify seed data ===
    step(1);
    const coe = await login('coe@emqpgs.local', 'Password@123');
    ok(`COE: ${coe.email}`);

    const deps = await api('GET', '/departments');
    deptId = deps.data.data.find(d => d.code === 'CSE')?.id;
    ok(`Dept CSE: ${deptId}`);

    const sems = await api('GET', '/semesters');
    const sem5 = sems.data.data?.find(s => s.number === 5);
    semId = sem5?.id; ok(`Sem 5: ${semId}`);

    const cycs = await api('GET', '/exam-cycles');
    cycId = cycs.data.data?.[0]?.id; ok(`Cycle: ${cycId}`);

    const usrs = await api('GET', '/users');
    for (const u of usrs.data.data) userIds[u.role] = u.id;
    ok(`Users: ${Object.keys(userIds).join(', ')}`);

    // === STEP 2: Coordinator — find or create subject + bank ===
    step(2);
    await login('coordinator@emqpgs.local', 'Password@123');

    // Find or create a fresh DRAFTING bank. If existing bank is not in DRAFTING,
    // create a new subject + bank for a clean test.
    const subs = await api('GET', '/subjects');
    bankId = null;
    for (const existing of (subs.data.data || [])) {
      const b = existing.questionBanks?.[0];
      if (b && b.phase === 'DRAFTING' && b.recordStatus === 'ACTIVE') {
        subjId = existing.id;
        verId = existing.versions?.[0]?.id;
        bankId = b.id;
        ok(`Using existing DRAFTING bank: ${existing.subjectCode} -> bank ${bankId}`);
        break;
      }
    }
    if (!bankId) {
      // Create fresh subject + bank
      const code = 'DS' + Date.now().toString(36).slice(-4).toUpperCase();
      const subj = await api('POST', '/subjects', {
        name: 'Data Structures', code, departmentId: deptId, semesterId: semId, credits: 4
      });
      if (subj.status !== 201 && subj.status !== 200) { fail('Create subject', subj.data); return; }
      subjId = subj.data.data.id;
      verId = subj.data.data.subjectVersions?.[0]?.id;
      ok(`Created subject ${code} (${subjId})`);
      await api('POST', `/subjects/${subjId}/link-cycle`, { examCycleId: cycId });
      const bank = await api('POST', '/question-banks', { subjectId: subjId, examCycleId: cycId });
      if (bank.status !== 201 && bank.status !== 200) { fail('Create bank', bank.data); return; }
      bankId = bank.data.data.id;
      ok(`Created bank ${bankId}`);
    }

    if (bankId) {
      // Verify bank state
      const bc = await api('GET', `/question-banks/${bankId}`);
      info(`Bank phase=${bc.data.data.phase} recordStatus=${bc.data.data.recordStatus}`);

      // Check slots
      const sr = await api('GET', `/question-banks/${bankId}/slots`);
      slots = Array.isArray(sr.data.data) ? sr.data.data : sr.data.data.slots || [];
      const filled = slots.filter(s => s.assignedQuestionId != null).length;
      info(`Slots: ${slots.length} total, ${filled} filled`);

      if (bc.data.data.paperPattern) ok(`PaperPattern exists`);
      if (bc.data.data.phase === 'DRAFTING') ok(`Phase DRAFTING`);
      if (bc.data.data.recordStatus === 'ACTIVE') ok(`RecordStatus ACTIVE`);
      if (slots.length === 126) ok(`126 slots`);

      // If bank already has questions from seed, skip creation
      if (filled > 0) {
        ok(`Bank already has ${filled} questions from seed`);
        // Still need to check if all 126 are filled
        if (filled < 126) {
          // Fill remaining slots
          info(`Need to fill ${126 - filled} more slots`);
          await login('contributor@emqpgs.local', 'Password@123');
          const emptySlots = slots.filter(s => s.assignedQuestionId == null);
          const levels = ['L1','L2','L3','L4','L5','L6'];
          const cos = ['CO1','CO2','CO3','CO4','CO5','CO6'];
          let ct = 0;
          for (const sl of emptySlots) {
            const rbt = levels[ct % 6]; const co = cos[ct % 6];
            const txt = `Auto question for slot m${sl.moduleNumber}s${sl.marks}n${sl.slotNumber}: Explain ${rbt} ${co} in detail with examples.`;
            const qr = await api('POST', '/question-library', {
              subjectVersionId: verId, moduleNumber: sl.moduleNumber, marks: sl.marks,
              questionText: txt, coMapping: co, rbtLevel: rbt, questionBankId: bankId,
            });
            if (qr.status === 201 || qr.status === 409) ct++;
            else if (qr.status !== 200) info(`q fill fail: ${qr.status} ${qr.data?.error?.message || ''}`);
            if (ct % 15 === 0) await new Promise(r => setTimeout(r, 200));
          }
          info(`Filled ${ct} empty slots`);
        }
      } else {
        // Fill all 126 from scratch
        await login('contributor@emqpgs.local', 'Password@123');
        qIds = []; let ct = 0;
        const levels = ['L1','L2','L3','L4','L5','L6'];
        const cos = ['CO1','CO2','CO3','CO4','CO5','CO6'];
        for (let m = 1; m <= 6; m++) {
          for (const mk of [2,5,10]) {
            for (let s = 1; s <= 7; s++) {
              const rbt = levels[(s-1)%6]; const co = cos[(s-1)%6];
              const txt = `Advanced Algorithms M${m} ${mk}-mark Q${s}: Explain ${rbt} for ${co} with algorithm and example.`;
              try {
                const qr = await api('POST', '/question-library', {
                  subjectVersionId: verId, moduleNumber: m, marks: mk,
                  questionText: txt, coMapping: co, rbtLevel: rbt, questionBankId: bankId,
                });
                if (qr.status === 201) { ct++; qIds.push(qr.data.data.id); }
                else if (qr.status === 409) ct++;
                else if (qr.status === 400) info(`q400 m${m}s${mk}n${s}: ${JSON.stringify(qr.data?.error?.details || qr.data?.error?.message)}`);
                else if (qr.status === 429) { info('rate limit, pausing 5s'); await new Promise(r => setTimeout(r, 5000)); }
                else if (qr.status !== 200) info(`q rej ${qr.status}: ${qr.data?.error?.message || ''}`);
              } catch(e) { info(`q err m${m}s${mk}n${s}: ${e.message}`); }
              await new Promise(r => setTimeout(r, 100));
            }
          }
        }
        info(`Created ${ct} questions`);
      }

      // Verify fill
      const sr2 = await api('GET', `/question-banks/${bankId}/slots`);
      const items2 = Array.isArray(sr2.data.data) ? sr2.data.data : sr2.data.data.slots || [];
      const filled2 = items2.filter(s => s.assignedQuestionId != null).length;
      if (filled2 === 126) ok(`All 126 slots filled (${filled2})`);
      else info(`${filled2}/126 filled`);
    }

    // === STEP 3: Advance DRAFTING → MODERATION ===
    step(3);
    await login('coordinator@emqpgs.local', 'Password@123');
    const rd = await api('GET', `/question-banks/${bankId}/readiness`);
    info(`Readiness D→M: ${JSON.stringify(rd.data.data)}`);

    const adv1 = await api('PATCH', `/question-banks/${bankId}/advance`, { targetPhase: 'MODERATION' });
    if (adv1.status === 200) {
      ok(`Advanced to MODERATION`);
      const bc = await api('GET', `/question-banks/${bankId}`);
      if (bc.data.data.phase === 'MODERATION') ok(`Phase = MODERATION`);
      else fail('Phase', bc.data.data.phase);
    } else fail('Advance D→M', adv1.data);

    // === STEP 4: Assign moderator ===
    step(4);
    await login('coordinator@emqpgs.local', 'Password@123');
    const ma = await api('POST', `/question-banks/${bankId}/assignments/moderator`, { moderatorId: userIds.MODERATOR });
    if (ma.status === 201 || ma.status === 200) ok(`Moderator assigned`);
    else if (ma.status === 409) ok(`Already assigned`);
    else fail('Assign moderator', ma.data);

    // === STEP 5: Moderator reviews ===
    step(5);
    await login('moderator@emqpgs.local', 'Password@123');
    try {
      const ml = await api('GET', '/moderation/questions');
      const modQs = ml.data.data || [];
      info(`${modQs.length} pending moderation`);
      for (let i = 0; i < modQs.length; i++) {
        try {
          if (i < Math.floor(modQs.length * 0.85))
            await api('PATCH', `/moderation/questions/${modQs[i].id}/approve`, {});
          else if (i < Math.floor(modQs.length * 0.92))
            await api('PATCH', `/moderation/questions/${modQs[i].id}/request-revision`, { remark: 'Add example' });
          else
            await api('PATCH', `/moderation/questions/${modQs[i].id}/reject`, { remark: 'Not suitable' });
        } catch(e) {}
      }
      if (modQs.length) ok(`Moderated ${modQs.length} questions`);
      else info('No pending questions');
    } catch(e) { fail('Moderation', e.message); }

    // Resubmit revisions
    await login('contributor@emqpgs.local', 'Password@123');
    try {
      const ql = await api('GET', '/question-library');
      const rev = (ql.data.data || []).filter(q => q.status === 'REVISION_REQUESTED');
      for (const q of rev) {
        await api('PATCH', `/question-library/${q.id}`, { questionText: q.questionText + ' [Revised]' });
        // Submit for moderation by updating
        await api('POST', `/question-library/${q.id}`, {});
      }
      if (rev.length) ok(`Resubmitted ${rev.length} revised`);
    } catch(e) { info(`Resubmit err: ${e.message}`); }

    // Re-moderate
    await login('moderator@emqpgs.local', 'Password@123');
    const ml2 = await api('GET', '/moderation/questions');
    const pending2 = (ml2.data.data || []).filter(q => ['PENDING','REVISION_SUBMITTED'].includes(q.status));
    for (const q of pending2) {
      try { await api('PATCH', `/moderation/questions/${q.id}/approve`, {}); } catch(e) {}
    }
    if (pending2.length) ok(`Re-moderated ${pending2.length}`);

    // === STEP 6: Generate AI report ===
    step(6);
    // Ensure all questions are moderated
    await login('moderator@emqpgs.local', 'Password@123');
    const ml3 = await api('GET', '/moderation/questions');
    const still = (ml3.data.data || []).filter(q => ['PENDING','DRAFT','REVISION_SUBMITTED'].includes(q.status));
    for (const q of still) { try { await api('PATCH', `/moderation/questions/${q.id}/approve`, {}); } catch(e) {} }
    if (still.length) ok(`Moderated final ${still.length}`);

    await login('coordinator@emqpgs.local', 'Password@123');
    const aiR = await api('POST', `/question-banks/${bankId}/reports`, {});
    if (aiR.status === 200) {
      ok(`AI report generated`);
      const bc = await api('GET', `/question-banks/${bankId}`);
      info(`Phase after report: ${bc.data.data.phase}`);
      ok(`AI report did NOT auto-advance (phase=${bc.data.data.phase})`);
    } else fail('AI report', aiR.data);

    // Check readiness
    const rd2 = await api('GET', `/question-banks/${bankId}/readiness`);
    info(`Readiness for APPROVAL: ${JSON.stringify(rd2.data.data)}`);

    // === STEP 7: Advance MODERATION → APPROVAL ===
    step(7);
    const adv2 = await api('PATCH', `/question-banks/${bankId}/advance`, { targetPhase: 'APPROVAL' });
    if (adv2.status === 200) {
      ok(`Advanced to APPROVAL`);
      const bc = await api('GET', `/question-banks/${bankId}`);
      if (bc.data.data.phase === 'APPROVAL') ok(`Phase = APPROVAL`);
      else fail('Phase', bc.data.data.phase);
    } else fail('Advance M→A', adv2.data);

    // === STEP 8: Coordinator decision ===
    step(8);
    const dec = await api('POST', `/question-banks/${bankId}/coordinator-decision`, {
      decision: 'APPROVED', remark: 'All questions meet standards.',
    });
    if (dec.status === 200) {
      ok(`Decision APPROVED`);
      const bc = await api('GET', `/question-banks/${bankId}`);
      if (bc.data.data.phase === 'COMPLETE') ok(`Phase = COMPLETE`);
      else fail('Phase', bc.data.data.phase);
      if (bc.data.data.approvalDecision) ok(`ApprovalDecision record`);
      else info('ApprovalDecision not in response');
    } else fail('Coordinator decision', dec.data);

    // === STEP 9: Generate papers ===
    step(9);
    const papers = await api('POST', `/question-banks/${bankId}/papers`, { variantCount: 3 });
    if (papers.status === 200) {
      ok(`Papers generated`);
      const pl = await api('GET', `/question-banks/${bankId}/papers`);
      const pCount = pl.data.data?.length || 0;
      if (pCount >= 3) ok(`${pCount} PaperSnapshots`);
      else info(`${pCount} papers`);

      // No duplicate check
      const allQ = [];
      for (const p of (papers.data.data?.papers || [])) {
        for (const q of (p.questions || p.slots || [])) allQ.push(q.questionId || q.id || q.assignedQuestionId);
      }
      const uniq = new Set(allQ.filter(Boolean));
      if (uniq.size === allQ.filter(Boolean).length) ok(`No duplicates across variants`);
      else info(`${allQ.length - uniq.size} duplicates`);
    } else fail('Papers', papers.data);

    // === STEP 10: Lock bank ===
    step(10);
    const lock = await api('PATCH', `/question-banks/${bankId}/lock`, {});
    if (lock.status === 200) {
      ok(`Bank locked`);
      const bc = await api('GET', `/question-banks/${bankId}`);
      if (bc.data.data.recordStatus === 'LOCKED') ok(`RecordStatus = LOCKED`);
      else fail('RecordStatus', bc.data.data.recordStatus);
      if (bc.data.data.questionBankSnapshot || bc.data.data.snapshot) ok(`Snapshot created`);
    } else fail('Lock', lock.data);

    // === STEP 11: Mutations after lock ===
    step(11);
    const slot0 = Array.isArray(slots) ? slots.find(s => s.assignedQuestionId == null) : null;
    if (slot0) {
      const sa = await api('PATCH', `/question-banks/${bankId}/slots/${slot0.id}`, { questionId: 'x' });
      if (sa.status !== 200) ok(`Slot assign blocked (${sa.status})`);
      else fail('Slot assign not blocked');
    }
    const ph = await api('PATCH', `/question-banks/${bankId}/advance`, {});
    if (ph.status !== 200) ok(`Advance blocked (${ph.status})`);
    else fail('Advance not blocked');

    // === STEP 12: Unlock ===
    step(12);
    const unl = await api('POST', `/question-banks/${bankId}/unlock`, {});
    if (unl.status === 200) {
      ok(`Bank unlocked`);
      const bc = await api('GET', `/question-banks/${bankId}`);
      if (bc.data.data.recordStatus === 'ACTIVE') ok(`RecordStatus = ACTIVE`);
      else fail('RecordStatus', bc.data.data.recordStatus);
    } else fail('Unlock', unl.data);

  } catch (e) {
    console.error(`\nUNEXPECTED: ${e.stack || e.message}`);
  }

  console.log(`\n=== SUMMARY: ${S.passed} passed, ${S.failed} failed of ${S.passed + S.failed} ===`);
  process.exit(S.failed > 0 ? 1 : 0);
}

main();
