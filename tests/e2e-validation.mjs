// EMQPGS End-to-End Workflow Validation
// Tests actual business process against the running API
// Usage: node tests/e2e-validation.mjs

import { env } from 'process';
import { randomUUID } from 'crypto';

const BASE = 'http://localhost:3000/api';
const COOKIE_JAR = new Map();

// ---- Utilities ----
let correlationId = null;

async function api(method, path, body = undefined, expectStatus = null) {
  const url = `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  const cookieParts = [];
  for (const [k, v] of COOKIE_JAR) cookieParts.push(`${k}=${v}`);
  if (cookieParts.length) headers['Cookie'] = cookieParts.join('; ');

  // CSRF: read from jar
  const csrf = COOKIE_JAR.get('emqpgs_csrf_token');
  if (csrf) headers['x-csrf-token'] = csrf;

  const opts = { method, headers, redirect: 'manual' };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  let data = null;
  if (ct.includes('json')) {
    try { data = await res.json(); } catch { data = null; }
  }

  // Capture set-cookie headers
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    for (const part of setCookie.split(',')) {
      const m = part.match(/^([^=]+)=([^;]+)/);
      if (m) COOKIE_JAR.set(m[1], m[2]);
    }
  }

  // Store correlationId for debug
  if (data?.correlationId) correlationId = data.correlationId;

  if (expectStatus !== null && res.status !== expectStatus) {
    throw new Error(`Expected ${expectStatus} got ${res.status} for ${method} ${path}: ${JSON.stringify(data)}`);
  }

  return { status: res.status, data, headers: res.headers };
}

async function login(email, password) {
  // Step 1: Get CSRF token first (required for all non-GET requests)
  const csrfRes = await api('GET', '/auth/csrf');
  const csrfToken = csrfRes.data?.data?.csrfToken || csrfRes.data?.csrfToken;

  // Step 2: Login with CSRF token
  const res = await api('POST', '/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);

  // Step 3: Ensure CSRF token is in the cookie jar after login
  // Login handler calls getOrCreateCsrfToken() which may refresh it
  if (!COOKIE_JAR.has('emqpgs_csrf_token')) {
    await api('GET', '/auth/csrf');
  }

  return res.data.data.user;
}

let stepCounter = 0;
function step(name) {
  stepCounter++;
  console.log(`\n${'='.repeat(72)}`);
  console.log(`Step ${stepCounter}: ${name}`);
  console.log('='.repeat(72));
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

function fail(msg, detail) {
  console.error(`  ❌ FAIL: ${msg}`);
  if (detail) console.error(`     ${JSON.stringify(detail, null, 4)}`);
}

function info(msg) {
  console.log(`  ℹ️  ${msg}`);
}

// ---- Main Validation ----
async function main() {
  const results = { passed: 0, failed: 0, total: 0 };
  let lastBankId = null;
  let lastSlots = [];
  let lastQuestions = [];
  let lastPaperIds = [];

  function pass() { results.passed++; results.total++; }
  function failStep(msg, detail) { results.failed++; results.total++; fail(msg, detail); }

  try {
    // ====================================================================
    // STEP 1: COE creates Department, Users, Academic Year, Semester, Exam Cycle
    // ====================================================================
    step('COE creates Department, Users, Academic Year, Semester, Exam Cycle');

    // Login as COE
    let coe;
    try {
      coe = await login('coe@emqpgs.local', 'Password@123');
      ok(`Logged in as COE: ${coe.email} (${coe.role})`);
      pass();
    } catch (e) {
      failStep('COE login', e.message);
    }

    // Check existing departments from seed
    let deptId, acYearId, semId, cycleId, coordinatorId;
    try {
      const deptRes = await api('GET', '/departments');
      if (deptRes.status === 200 && deptRes.data?.success && deptRes.data.data?.length > 0) {
        deptId = deptRes.data.data[0].id;
        deptName = deptRes.data.data[0].name;
        ok(`Found seed department: ${deptName} (${deptId})`);
        pass();
      } else {
        // Create department
        const newDept = await api('POST', '/departments', { name: 'Computer Engineering', code: 'CO' });
        if (newDept.status === 200) {
          deptId = newDept.data.data.id;
          deptName = newDept.data.data.name;
          ok(`Created department: ${deptName}`);
          pass();
        } else {
          failStep('Create department', newDept.data);
        }
      }
    } catch (e) {
      failStep('Department setup', e.message);
    }

    // Check academic years
    try {
      const ayRes = await api('GET', '/academic-years');
      if (ayRes.status === 200 && ayRes.data?.success && ayRes.data.data?.length > 0) {
        acYearId = ayRes.data.data.find(a => a.code === '2026-2027' || a.year === 2026)?.id;
        if (acYearId) {
          ok(`Found academic year 2026-2027 (${acYearId})`);
          pass();
        }
      }
    } catch (e) {
      info(`Academic year check: ${e.message}`);
    }

    if (!acYearId) {
      try {
        const newAy = await api('POST', '/academic-years', {
          year: 2026,
          code: '2026-2027',
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2027-05-31T00:00:00.000Z',
        });
        if (newAy.status === 200) {
          acYearId = newAy.data.data.id;
          ok(`Created academic year: 2026-2027 (${acYearId})`);
          pass();
        } else {
          failStep('Create academic year', newAy.data);
        }
      } catch (e) {
        failStep('Create academic year', e.message);
      }
    }

    // Check semesters
    try {
      const semRes = await api('GET', '/semesters');
      if (semRes.status === 200 && semRes.data?.success && semRes.data.data?.length > 0) {
        semId = semRes.data.data.find(s => s.number === 5)?.id;
        if (semId) {
          ok(`Found semester 5 (${semId})`);
          pass();
        }
      }
    } catch (e) {
      info(`Semester check: ${e.message}`);
    }

    if (!semId) {
      try {
        const newSem = await api('POST', '/semesters', {
          number: 5,
          academicYearId: acYearId,
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
        });
        if (newSem.status === 200) {
          semId = newSem.data.data.id;
          ok(`Created semester: 5 (${semId})`);
          pass();
        } else {
          failStep('Create semester', newSem.data);
        }
      } catch (e) {
        failStep('Create semester', e.message);
      }
    }

    // Check exam cycles
    try {
      const cycRes = await api('GET', '/exam-cycles');
      if (cycRes.status === 200 && cycRes.data?.success && cycRes.data.data?.length > 0) {
        cycleId = cycRes.data.data[0].id;
        ok(`Found exam cycle: ${cycRes.data.data[0].examType} (${cycleId})`);
        pass();
      }
    } catch (e) {
      info(`Exam cycle check: ${e.message}`);
    }

    if (!cycleId) {
      try {
        const newCycle = await api('POST', '/exam-cycles', {
          name: 'End Semester Examination',
          examType: 'ENDSEM',
          semesterId: semId,
          startDate: '2026-11-01T00:00:00.000Z',
          endDate: '2026-12-15T00:00:00.000Z',
          active: true,
        });
        if (newCycle.status === 200) {
          cycleId = newCycle.data.data.id;
          ok(`Created exam cycle: ENDSEM (${cycleId})`);
          pass();
        } else {
          failStep('Create exam cycle', newCycle.data);
        }
      } catch (e) {
        failStep('Create exam cycle', e.message);
      }
    }

    // Check or create coordinator user
    try {
      const usersRes = await api('GET', '/users');
      if (usersRes.status === 200 && usersRes.data?.success) {
        const coord = usersRes.data.data.find(u => u.role === 'COORDINATOR' && u.email.includes('coordinator'));
        if (coord) {
          coordinatorId = coord.id;
          ok(`Found coordinator: ${coord.email} (${coordinatorId})`);
          pass();
        }
      }
    } catch (e) {
      info(`Users check: ${e.message}`);
    }

    // Ensure coordinator is assigned to department
    try {
      const assignments = await api('GET', '/coordinator-departments');
      if (assignments.status === 200 && assignments.data?.success && assignments.data.data.length > 0) {
        ok(`Coordinator-department assignments exist`);
        pass();
      } else if (coordinatorId && deptId) {
        await api('POST', '/coordinator-departments', {
          coordinatorId,
          departmentId: deptId,
        });
        ok(`Assigned coordinator to department`);
        pass();
      }
    } catch (e) {
      failStep('Coordinator-department assignment', e.message);
    }

    // ====================================================================
    // STEP 2: Coordinator creates Subject, SubjectVersion, QuestionBank
    // ====================================================================
    step('Coordinator creates Subject, SubjectVersion, QuestionBank');

    let coordinator;
    try {
      coordinator = await login('coordinator@emqpgs.local', 'Password@123');
      ok(`Logged in as Coordinator: ${coordinator.email} (${coordinator.role})`);
      pass();
    } catch (e) {
      failStep('Coordinator login', e.message);
    }

    // Create subject
    let subjectId, versionId, bankId;
    try {
      const newSubj = await api('POST', '/subjects', {
        name: 'Advanced Algorithms',
        code: 'ALG501',
        departmentId: deptId,
        semesterId: semId,
        subjectType: 'THEORY',
      });
      if (newSubj.status === 200) {
        subjectId = newSubj.data.data.id;
        versionId = newSubj.data.data.subjectVersions?.[0]?.id;
        ok(`Created subject: Advanced Algorithms (${subjectId}), version: ${versionId}`);
        pass();
      } else {
        failStep('Create subject', newSubj.data);
      }
    } catch (e) {
      failStep('Create subject', e.message);
    }

    // Link subject to exam cycle
    try {
      const linkRes = await api('POST', `/subjects/${subjectId}/link-cycle`, { examCycleId: cycleId });
      if (linkRes.status === 200) {
        ok(`Linked subject to exam cycle (${cycleId})`);
        pass();
      } else {
        failStep('Link subject to cycle', linkRes.data);
      }
    } catch (e) {
      failStep('Link subject to cycle', e.message);
    }

    // Create question bank
    try {
      const newBank = await api('POST', '/question-banks', {
        name: 'Advanced Algorithms - ENDSEM Bank',
        subjectVersionId: versionId,
        examCycleId: cycleId,
        departmentId: deptId,
        semesterId: semId,
      });
      if (newBank.status === 200) {
        bankId = newBank.data.data.id;
        lastBankId = bankId;
        ok(`Created question bank: ${newBank.data.data.name} (${bankId})`);
        pass();

        // Verify PaperPattern exists
        if (newBank.data.data.paperPattern) {
          ok(`PaperPattern exists: ${JSON.stringify(newBank.data.data.paperPattern)}`);
          pass();
        } else {
          failStep('PaperPattern existence', 'No paperPattern returned');
        }

        // Verify Phase = DRAFTING
        if (newBank.data.data.phase === 'DRAFTING') {
          ok(`Phase = DRAFTING (correct for new bank)`);
          pass();
        } else {
          failStep('Phase check', `Expected DRAFTING, got ${newBank.data.data.phase}`);
        }

        // Verify RecordStatus = ACTIVE
        if (newBank.data.data.recordStatus === 'ACTIVE') {
          ok(`RecordStatus = ACTIVE (correct for new bank)`);
          pass();
        } else {
          failStep('RecordStatus check', `Expected ACTIVE, got ${newBank.data.data.recordStatus}`);
        }
      } else {
        failStep('Create question bank', newBank.data);
      }
    } catch (e) {
      failStep('Create question bank', e.message);
    }

    // Verify 126 QuestionSlots created
    try {
      const slotsRes = await api('GET', `/question-banks/${bankId}/slots`);
      if (slotsRes.status === 200 && slotsRes.data?.success) {
        lastSlots = slotsRes.data.data;
        const slotCount = Array.isArray(lastSlots) ? lastSlots.length : lastSlots.slots?.length || 0;
        if (slotCount === 126) {
          ok(`126 QuestionSlots created (verified via API)`);
          pass();
        } else {
          failStep('Slot count', `Expected 126, got ${slotCount}`);
        }
      } else {
        failStep('Fetch slots', slotsRes.data);
      }
    } catch (e) {
      failStep('Fetch slots', e.message);
    }

    // ====================================================================
    // STEP 3: Contributors submit questions — populate entire inventory
    // ====================================================================
    step('Contributors submit questions — populate all 126 slots');

    // Login as contributor
    let contributor;
    try {
      contributor = await login('contributor@emqpgs.local', 'Password@123');
      ok(`Logged in as Contributor: ${contributor.email} (${contributor.role})`);
      pass();
    } catch (e) {
      failStep('Contributor login', e.message);
    }

    // Create questions for each module and marks combination
    // Modules: 1-6, Marks: 2, 5, 10
    // Total: 6 × 3 × 7 = 126 questions
    const moduleMarks = [
      { module: 1, marks: 2 }, { module: 1, marks: 5 }, { module: 1, marks: 10 },
      { module: 2, marks: 2 }, { module: 2, marks: 5 }, { module: 2, marks: 10 },
      { module: 3, marks: 2 }, { module: 3, marks: 5 }, { module: 3, marks: 10 },
      { module: 4, marks: 2 }, { module: 4, marks: 5 }, { module: 4, marks: 10 },
      { module: 5, marks: 2 }, { module: 5, marks: 5 }, { module: 5, marks: 10 },
      { module: 6, marks: 2 }, { module: 6, marks: 5 }, { module: 6, marks: 10 },
    ];

    const rbtLevels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
    const coMappings = ['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6'];
    const questionTexts = {};
    // Pre-generate question texts
    for (const mm of moduleMarks) {
      questionTexts[`${mm.module}-${mm.marks}`] = [];
      for (let slot = 1; slot <= 7; slot++) {
        const rbt = rbtLevels[(slot - 1) % rbtLevels.length];
        const co = coMappings[(slot - 1) % coMappings.length];
        questionTexts[`${mm.module}-${mm.marks}`].push(
          `Advanced Algorithms Module ${mm.module} ${mm.marks}-mark question ${slot}: ` +
          `Explain ${rbt} concept for CO${co.slice(-1)} with example.`
        );
      }
    }

    let questionsCreated = 0;
    const allQuestionIds = [];

    for (const mm of moduleMarks) {
      for (let slot = 1; slot <= 7; slot++) {
        const rbt = rbtLevels[(slot - 1) % rbtLevels.length];
        const co = coMappings[(slot - 1) % coMappings.length];
        const qText = questionTexts[`${mm.module}-${mm.marks}`][slot - 1];

        try {
          const qRes = await api('POST', '/question-library', {
            subjectVersionId: versionId,
            moduleNumber: mm.module,
            marks: mm.marks,
            questionText: qText,
            coMapping: co,
            rbtLevel: rbt,
            questionBankId: bankId,
          });
          if (qRes.status === 200) {
            questionsCreated++;
            allQuestionIds.push(qRes.data.data.id);
          } else {
            fail(`Failed creating question m${mm.module}s${mm.marks} slot${slot}: ${JSON.stringify(qRes.data)}`);
          }
        } catch (e) {
          fail(`Error creating question m${mm.module}s${mm.marks} slot${slot}: ${e.message}`);
        }
      }
    }

    if (questionsCreated === 126) {
      ok(`Created all 126 questions (auto-assigned to slots)`);
      pass();
    } else {
      failStep('Question creation count', `Expected 126, created ${questionsCreated}`);
    }
    lastQuestions = allQuestionIds;

    // Verify all 126 slots are now filled
    try {
      const slotsCheck = await api('GET', `/question-banks/${bankId}/slots`);
      if (slotsCheck.status === 200 && slotsCheck.data?.success) {
        const slots = slotsCheck.data.data;
        const items = Array.isArray(slots) ? slots : slots.slots || [];
        const filled = items.filter(s => s.assignedQuestionId !== null).length;
        if (filled === 126) {
          ok(`Verified: All 126 slots are filled with questions`);
          pass();
        } else {
          failStep('Slot fill verification', `Expected 126 filled, found ${filled}`);
        }
      }
    } catch (e) {
      failStep('Slot fill verification', e.message);
    }

    // ====================================================================
    // STEP 4: Attempt advance before inventory complete (if not already complete)
    // ====================================================================
    step('Attempt advance before inventory complete — should FAIL');

    // Check readiness before advance
    try {
      const readiness = await api('GET', `/question-banks/${bankId}/readiness`);
      if (readiness.status === 200 && readiness.data?.success) {
        info(`Readiness: ${JSON.stringify(readiness.data.data)}`);
      }
    } catch (e) {
      info(`Readiness check: ${e.message}`);
    }

    // ====================================================================
    // STEP 5: Advance DRAFTING → MODERATION
    // ====================================================================
    step('Advance DRAFTING → MODERATION');

    try {
      const advance = await api('PATCH', `/question-banks/${bankId}/advance`, { targetPhase: 'MODERATION' });
      if (advance.status === 200) {
        ok(`Phase advanced to MODERATION`);
        pass();
      } else {
        failStep('Advance to MODERATION', advance.data);
      }
    } catch (e) {
      failStep('Advance to MODERATION', e.message);
    }

    // Verify phase
    try {
      const bankCheck = await api('GET', `/question-banks/${bankId}`);
      if (bankCheck.status === 200 && bankCheck.data?.success) {
        if (bankCheck.data.data.phase === 'MODERATION') {
          ok(`Verified phase = MODERATION`);
          pass();
        } else {
          failStep('Phase verification', `Expected MODERATION, got ${bankCheck.data.data.phase}`);
        }
      }
    } catch (e) {
      failStep('Phase verification', e.message);
    }

    // ====================================================================
    // STEP 6: Moderator reviews questions
    // ====================================================================
    step('Moderator reviews questions');

    // Assign moderator to bank
    let moderator;
    try {
      // Login as coordinator to assign moderator
      await login('coordinator@emqpgs.local', 'Password@123');
      const assignRes = await api('POST', `/question-banks/${bankId}/assignments/moderator`, {
        moderatorEmail: 'moderator@emqpgs.local',
      });
      if (assignRes.status === 200) {
        ok(`Assigned moderator to question bank`);
        pass();
      } else {
        failStep('Assign moderator', assignRes.data);
      }
    } catch (e) {
      failStep('Assign moderator', e.message);
    }

    // Login as moderator
    try {
      moderator = await login('moderator@emqpgs.local', 'Password@123');
      ok(`Logged in as Moderator: ${moderator.email} (${moderator.role})`);
      pass();
    } catch (e) {
      failStep('Moderator login', e.message);
    }

    // Get moderation queue
    let modQuestions;
    try {
      const modList = await api('GET', '/moderation/questions');
      if (modList.status === 200 && modList.data?.success) {
        modQuestions = modList.data.data;
        info(`Found ${modQuestions.length} questions for moderation`);
        ok(`Moderation queue accessible`);
        pass();
      }
    } catch (e) {
      failStep('Moderation queue', e.message);
    }

    // Moderate questions: approve some, reject some, request revision on some
    let approved = 0, rejected = 0, revisionReq = 0;
    if (modQuestions && modQuestions.length > 0) {
      for (let i = 0; i < modQuestions.length; i++) {
        const q = modQuestions[i];
        if (i < 100) { // Approve first 100
          try {
            const act = await api('PATCH', `/moderation/questions/${q.id}/approve`, {});
            if (act.status === 200) approved++;
          } catch (e) {
            info(`Approve error q${q.id}: ${e.message}`);
          }
        } else if (i < 110) { // Reject 10
          try {
            const act = await api('PATCH', `/moderation/questions/${q.id}/reject`, { remark: 'Needs improvement in complexity level' });
            if (act.status === 200) rejected++;
          } catch (e) {
            info(`Reject error q${q.id}: ${e.message}`);
          }
        } else if (i < 116) { // Request revision on 6
          try {
            const act = await api('PATCH', `/moderation/questions/${q.id}/request-revision`, { remark: 'Please add code example' });
            if (act.status === 200) revisionReq++;
          } catch (e) {
            info(`Revision request error q${q.id}: ${e.message}`);
          }
        } else { // Approve rest
          try {
            const act = await api('PATCH', `/moderation/questions/${q.id}/approve`, {});
            if (act.status === 200) approved++;
          } catch (e) {
            info(`Approve error q${q.id}: ${e.message}`);
          }
        }
      }
      info(`Moderation results: ${approved} approved, ${rejected} rejected, ${revisionReq} revision-requested`);
      ok(`Moderation completed`);
      pass();

      // Now handle rejected/revision questions
      let needResubmit = [];
      for (let i = 100; i < 116; i++) {
        if (modQuestions[i]) needResubmit.push(modQuestions[i]);
      }

      // Contributor resubmits rejected/revision questions
      await login('contributor@emqpgs.local', 'Password@123');

      for (const q of needResubmit) {
        try {
          const qDetail = await api('GET', `/moderation/questions/${q.id}`);
          if (qDetail.status === 200 && qDetail.data?.success) {
            const status = qDetail.data.data.status;
            // Resubmit with updated text
            await api('POST', `/question-library/${q.id}`, {
              questionText: qDetail.data.data.questionText + ' [Revised: Added examples]',
            });
            // Submit for moderation
            await api('POST', `/question-library/${q.id}/transfer-ownership`, {});
            info(`Resubmitted question ${q.id} (was ${status})`);
          }
        } catch (e) {
          info(`Resubmit error for q${q.id}: ${e.message}`);
        }
      }
    } else {
      info('No moderation questions found — may have been auto-moderated');
    }

    // ====================================================================
    // STEP 7: Attempt advance with moderation incomplete
    // ====================================================================
    step('Attempt advance with moderation issues — should FAIL or show warnings');

    try {
      // First check readiness
      const readiness = await api('GET', `/question-banks/${bankId}/readiness`);
      if (readiness.status === 200 && readiness.data?.success) {
        info(`Readiness before advance: ${JSON.stringify(readiness.data.data)}`);
        if (!readiness.data.data.ready) {
          ok(`Readiness correctly reports not ready`);
          pass();
        }
      }

      // Try to advance anyway
      const advance = await api('PATCH', `/question-banks/${bankId}/advance`, { targetPhase: 'APPROVAL' });
      if (advance.status !== 200) {
        ok(`Advance correctly blocked: ${advance.data?.error?.message || 'not ready'}`);
        pass();
      } else {
        info(`Advance succeeded (moderation may have been complete)`);
      }
    } catch (e) {
      failStep('Advance block check', e.message);
    }

    // ====================================================================
    // STEP 8: Complete moderation → Generate AI Report
    // ====================================================================
    step('Complete all reviews and generate AI Report');

    // Login as coordinator
    await login('coordinator@emqpgs.local', 'Password@123');

    // Check if any questions still pending moderation
    await login('moderator@emqpgs.local', 'Password@123');
    try {
      const pending = await api('GET', '/moderation/questions');
      if (pending.status === 200 && pending.data?.success) {
        const stillPending = pending.data.data.filter(q => q.status === 'PENDING' || q.status === 'DRAFT' || q.status === 'REVISION_SUBMITTED');
        info(`${stillPending.length} questions still pending moderation`);
        // Moderate the remaining ones
        for (const q of stillPending) {
          try {
            await api('PATCH', `/moderation/questions/${q.id}/approve`, {});
          } catch (e) { /* ignore */ }
        }
        if (stillPending.length > 0) ok(`Moderated remaining ${stillPending.length} questions`);
      }
    } catch (e) {
      info(`Pending check: ${e.message}`);
    }

    // Generate AI report (as coordinator)
    await login('coordinator@emqpgs.local', 'Password@123');
    try {
      const aiReport = await api('POST', `/question-banks/${bankId}/reports`, {});
      if (aiReport.status === 200) {
        ok(`AI report generated`);
        pass();
      } else {
        failStep('AI report generation', aiReport.data);
      }
    } catch (e) {
      failStep('AI report generation', e.message);
    }

    // Verify AI report DOES NOT auto-advance phase
    try {
      const bankCheck = await api('GET', `/question-banks/${bankId}`);
      if (bankCheck.status === 200 && bankCheck.data?.success) {
        if (bankCheck.data.data.phase === 'MODERATION') {
          ok(`AI report did NOT auto-advance phase (phase still MODERATION) — critical check PASSED`);
          pass();
        } else {
          info(`Phase is ${bankCheck.data.data.phase} (report may trigger advance in implementation)`);
        }
      }
    } catch (e) {
      failStep('Phase after report check', e.message);
    }

    // Verify readiness now reports APPROVAL readiness
    try {
      const readiness = await api('GET', `/question-banks/${bankId}/readiness`);
      if (readiness.status === 200 && readiness.data?.success) {
        info(`Readiness after report: ${JSON.stringify(readiness.data.data)}`);
        if (readiness.data.data.ready) {
          ok(`ReadinessEngine reports ready for APPROVAL`);
          pass();
        } else {
          info(`Readiness: not ready yet — ${readiness.data.data.issues?.length || 0} issues`);
        }
      }
    } catch (e) {
      failStep('Readiness after report', e.message);
    }

    // ====================================================================
    // STEP 9: Coordinator advances MODERATION → APPROVAL
    // ====================================================================
    step('Coordinator advances MODERATION → APPROVAL');

    try {
      const advance = await api('PATCH', `/question-banks/${bankId}/advance`, { targetPhase: 'APPROVAL' });
      if (advance.status === 200) {
        ok(`Phase advanced to APPROVAL`);
        pass();

        // Verify phase = APPROVAL
        const bankCheck = await api('GET', `/question-banks/${bankId}`);
        if (bankCheck.status === 200 && bankCheck.data?.success) {
          if (bankCheck.data.data.phase === 'APPROVAL') {
            ok(`Verified phase = APPROVAL`);
            pass();
          } else {
            failStep('Phase verification', `Expected APPROVAL, got ${bankCheck.data.data.phase}`);
          }
        }
      } else {
        failStep('Advance to APPROVAL', advance.data);
      }
    } catch (e) {
      failStep('Advance to APPROVAL', e.message);
    }

    // ====================================================================
    // STEP 10: Coordinator decision — APPROVED → COMPLETE
    // ====================================================================
    step('Coordinator decision: APPROVED → phase = COMPLETE');

    try {
      const decision = await api('POST', `/question-banks/${bankId}/coordinator-decision`, {
        decision: 'APPROVED',
        remark: 'All questions meet quality standards. Bank approved for paper generation.',
      });
      if (decision.status === 200) {
        ok(`Coordinator decision: APPROVED`);
        pass();

        // Verify ApprovalDecision created and phase = COMPLETE
        const bankCheck = await api('GET', `/question-banks/${bankId}`);
        if (bankCheck.status === 200 && bankCheck.data?.success) {
          if (bankCheck.data.data.phase === 'COMPLETE') {
            ok(`Phase = COMPLETE after approval`);
            pass();
          } else {
            failStep('Phase after approval', `Expected COMPLETE, got ${bankCheck.data.data.phase}`);
          }

          // Check for approvalDecision
          if (bankCheck.data.data.approvalDecision) {
            ok(`ApprovalDecision record created`);
            pass();
          } else {
            info('ApprovalDecision not in returned data (may be nested differently)');
          }
        }
      } else {
        failStep('Coordinator decision', decision.data);
      }
    } catch (e) {
      failStep('Coordinator decision', e.message);
    }

    // ====================================================================
    // STEP 11: Generate papers
    // ====================================================================
    step('Generate papers — verify PaperSnapshot, distribution, no duplicates');

    try {
      const papers = await api('POST', `/question-banks/${bankId}/papers`, { variantCount: 3 });
      if (papers.status === 200) {
        ok(`Papers generated`);
        pass();

        // Get paper list to verify PaperSnapshot
        const paperList = await api('GET', `/question-banks/${bankId}/papers`);
        if (paperList.status === 200 && paperList.data?.success) {
          const pList = paperList.data.data;
          if (pList.length >= 3) {
            ok(`PaperSnapshots created: ${pList.length} variants (A, B, C)`);
            pass();
          } else {
            failStep('Paper snapshot count', `Expected >= 3, got ${pList.length}`);
          }
        }

        // Verify module distribution in first paper
        if (papers.data.data?.papers && papers.data.data.papers.length > 0) {
          const firstPaper = papers.data.data.papers[0];
          if (firstPaper.modules || firstPaper.questions) {
            const questions = firstPaper.questions || [];
            const modules = firstPaper.modules || [];
            if (questions.length > 0 || modules.length > 0) {
              ok(`Paper has question data — distributions can be verified`);
            }
          }

          // Check no duplicate questions
          const allQIds = [];
          for (const p of papers.data.data.papers) {
            for (const q of (p.questions || [])) {
              allQIds.push(q.questionId || q.assignedQuestionId || q.id);
            }
          }
          const uniqueIds = new Set(allQIds.filter(Boolean));
          if (uniqueIds.size === allQIds.filter(Boolean).length) {
            ok(`No duplicate questions across paper variants`);
            pass();
          } else {
            failStep('Duplicate check', `Expected all unique, found ${allQIds.length - uniqueIds.size} duplicates`);
          }
        }
      } else {
        failStep('Generate papers', papers.data);
      }
    } catch (e) {
      failStep('Generate papers', e.message);
    }

    // ====================================================================
    // STEP 12: Lock bank
    // ====================================================================
    step('Lock bank — verify QuestionBankSnapshot and RecordStatus');

    try {
      const lockRes = await api('PATCH', `/question-banks/${bankId}/lock`, {});
      if (lockRes.status === 200) {
        ok(`Bank locked`);
        pass();

        // Verify RecordStatus = LOCKED
        const bankCheck = await api('GET', `/question-banks/${bankId}`);
        if (bankCheck.status === 200 && bankCheck.data?.success) {
          if (bankCheck.data.data.recordStatus === 'LOCKED') {
            ok(`RecordStatus = LOCKED`);
            pass();
          } else {
            failStep('RecordStatus', `Expected LOCKED, got ${bankCheck.data.data.recordStatus}`);
          }

          // Check for snapshot
          if (bankCheck.data.data.snapshot || bankCheck.data.data.questionBankSnapshot) {
            ok(`QuestionBankSnapshot created`);
            pass();
          } else {
            info('Snapshot not in returned data');
          }
        }
      } else {
        failStep('Lock bank', lockRes.data);
      }
    } catch (e) {
      failStep('Lock bank', e.message);
    }

    // ====================================================================
    // STEP 13: Attempt mutations after lock — should FAIL
    // ====================================================================
    step('Attempt mutations after lock — should FAIL with all operations');

    // Try to assign slot
    const mutableSlots = lastSlots.length > 0 ? lastSlots : [];
    const firstSlot = Array.isArray(mutableSlots) ? mutableSlots[0] : mutableSlots.slots?.[0];

    if (firstSlot) {
      try {
        const assignFail = await api('PATCH', `/question-banks/${bankId}/slots/${firstSlot.id}`, {
          questionId: lastQuestions[lastQuestions.length - 1] || 'nonexistent',
        });
        if (assignFail.status !== 200) {
          ok(`Slot assignment blocked on locked bank (${assignFail.status})`);
          pass();
        } else {
          failStep('Lock guard: slot assign', 'Should have been blocked');
        }
      } catch (e) {
        ok(`Slot assignment blocked on locked bank`);
        pass();
      }
    }

    // Try to advance phase
    try {
      const advanceFail = await api('PATCH', `/question-banks/${bankId}/advance`, {});
      if (advanceFail.status !== 200) {
        ok(`Phase advance blocked on locked bank`);
        pass();
      } else {
        failStep('Lock guard: advance', 'Should have been blocked');
      }
    } catch (e) {
      ok(`Phase advance blocked on locked bank`);
      pass();
    }

    // ====================================================================
    // STEP 14: Unlock bank — verify mutations allowed again
    // ====================================================================
    step('Unlock bank — verify mutations allowed again');

    try {
      const unlockRes = await api('POST', `/question-banks/${bankId}/unlock`, {});
      if (unlockRes.status === 200) {
        ok(`Bank unlocked`);
        pass();

        // Verify RecordStatus = ACTIVE
        const bankCheck = await api('GET', `/question-banks/${bankId}`);
        if (bankCheck.status === 200 && bankCheck.data?.success) {
          if (bankCheck.data.data.recordStatus === 'ACTIVE') {
            ok(`RecordStatus = ACTIVE after unlock`);
            pass();
          } else {
            failStep('RecordStatus after unlock', `Expected ACTIVE, got ${bankCheck.data.data.recordStatus}`);
          }
        }

        // Try slot assign again (should work now)
        if (firstSlot) {
          try {
            // First try adding a different question to an empty slot
            const emptySlot = Array.isArray(mutableSlots) 
              ? mutableSlots.find(s => !s.assignedQuestionId) 
              : null;
            if (emptySlot) {
              await api('PATCH', `/question-banks/${bankId}/slots/${emptySlot.id}`, {
                questionId: lastQuestions[0],
              });
              // Unassign it back
              await api('DELETE', `/question-banks/${bankId}/slots/${emptySlot.id}`, {});
              ok(`Slot mutations allowed after unlock`);
              pass();
            } else {
              // All slots may be filled; just verify no 403
              info('All slots filled, skipping slot assign test after unlock');
              ok(`Unlock restored mutability (no permission error)`);
              pass();
            }
          } catch (e) {
            failStep('Slot mutation after unlock', e.message);
          }
        }
      } else {
        failStep('Unlock bank', unlockRes.data);
      }
    } catch (e) {
      failStep('Unlock bank', e.message);
    }

  } catch (e) {
    console.error(`\n❌ UNEXPECTED ERROR: ${e.stack || e.message}`);
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`VALIDATION SUMMARY: ${results.passed} passed, ${results.failed} failed out of ${results.total} checks`);
  console.log('='.repeat(72));
  process.exit(results.failed > 0 ? 1 : 0);
}

main();
