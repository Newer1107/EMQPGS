# AcademicUnit & Programme Removal — Implementation Specification

**Objective:** Remove AcademicUnit and Programme. Rename every `academicUnitId`/`programmeId` field to `departmentId`. Rename every `academicUnit`/`programme` relation to `department`. Delete 12 files, modify 35 files. Zero behavior changes.

---

## A. Navigation Changes (2 files)

### A1. `src/components/layout/app-shell.tsx`

**Remove these 2 entries from the `navItems` array:**
```
{ href: "/dashboard/coe/academic-units", label: "Academic Units", roles: ["COE"] },  // DELETE
{ href: "/dashboard/coe/programmes", label: "Programmes", roles: ["COE"] },           // DELETE
```

**Update `getSection()` function — remove these entries from the array:**
```
"/dashboard/coe/academic-units",   // DELETE THIS LINE
"/dashboard/coe/programmes",       // DELETE THIS LINE
```

### A2. `src/components/layout/breadcrumbs.tsx`

**Remove these 2 entries from the `routeLabels` record:**
```
"academic-units": "Academic Units",  // DELETE
programmes: "Programmes",            // DELETE
```

---

## B. Prisma Schema Changes (1 file)

### B1. File: `prisma/schema.prisma`

**Delete enums:**
```
enum AcademicUnitType { ES_H DEPARTMENT }
enum DegreeType { BE BTECH MTECH PHD DIPLOMA }
```

**Delete model AcademicUnit (entire block):**
```
/// AcademicUnit represents curriculum ownership (ES&H, Computer Engineering, IT, etc.).
/// This is distinct from Department, which represents faculty HR affiliation.
model AcademicUnit {
  id        String           @id @default(cuid())
  name      String
  code      String           @unique
  type      AcademicUnitType @default(DEPARTMENT)
  hodName   String
  isActive  Boolean          @default(true)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  programmes          Programme[]         @relation("programmeHomeUnit")
  programmesFirstYear Programme[]         @relation("programmeFirstYearUnit")
  curriculumSubjects  CurriculumSubject[]
  batchSemesters      BatchSemester[]     @relation("batchSemesterAcademicUnit")
}
```

**Delete model Programme (entire block):**
```
/// Programme represents a degree a student graduates with (BE Computer Engineering, BE IT, etc.).
/// Owned by an AcademicUnit. Accreditation is per Programme.
model Programme {
  id                      String     @id @default(cuid())
  name                    String
  code                    String     @unique
  degreeType              DegreeType @default(BE)
  durationYears           Int        @default(4)
  durationSemesters       Int        @default(8)
  homeAcademicUnitId      String
  firstYearAcademicUnitId String?
  isActive                Boolean    @default(true)
  createdAt               DateTime   @default(now())
  updatedAt               DateTime   @updatedAt

  homeAcademicUnit      AcademicUnit  @relation("programmeHomeUnit", fields: [homeAcademicUnitId], references: [id])
  firstYearAcademicUnit AcademicUnit? @relation("programmeFirstYearUnit", fields: [firstYearAcademicUnitId], references: [id])

  curriculumSchemes CurriculumScheme[]
  batches           Batch[]
}
```

**Update Department — add 2 inverse relations:**
```
model Department {
  // ... existing fields stay unchanged ...

  // ... existing relations stay ...
  users                  User[]
  coordinatorAssignments CoordinatorDepartmentAssignment[]
  subjects               Subject[]

  // ADD these 2 lines:
  curriculumSchemes      CurriculumScheme[]
  batches                Batch[]
}
```

**Update CurriculumScheme:**
```
model CurriculumScheme {
  id                 String             @id @default(cuid())
  departmentId       String             // RENAMED from programmeId
  name               String
  year               Int
  durationSemesters  Int                @default(8)  // NEW — moved from Programme
  isActive           Boolean            @default(true)
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  department         Department         @relation(fields: [departmentId], references: [id])  // RENAMED from programme
  curriculumSubjects CurriculumSubject[]
  batches            Batch[]

  @@unique([departmentId, year])  // UPDATED from [programmeId, year]
}
```

**Update CurriculumSubject:**
```
model CurriculumSubject {
  id                 String          @id @default(cuid())
  curriculumSchemeId String
  subjectId          String
  semesterNumber     Int
  departmentId       String          // RENAMED from academicUnitId
  groupAssignment    GroupAssignment @default(ALL)
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  curriculumScheme   CurriculumScheme @relation(fields: [curriculumSchemeId], references: [id])
  subject            Subject          @relation(fields: [subjectId], references: [id])
  department         Department       @relation(fields: [departmentId], references: [id])  // RENAMED from academicUnit

  @@unique([curriculumSchemeId, subjectId, semesterNumber, groupAssignment])
  @@index([curriculumSchemeId, semesterNumber, departmentId])  // UPDATED from academicUnitId
  @@index([subjectId])
}
```

**Update Batch:**
```
model Batch {
  id                     String      @id @default(cuid())
  name                   String
  code                   String      @unique
  departmentId           String      // RENAMED from programmeId
  curriculumSchemeId     String
  admissionYear          Int
  graduationYear         Int
  status                 BatchStatus @default(ACTIVE)
  hasTeachingGroups      Boolean     @default(false)
  currentBatchSemesterId String?
  currentSemesterNumber  Int?
  createdAt              DateTime    @default(now())
  updatedAt              DateTime    @updatedAt

  department             Department        @relation(fields: [departmentId], references: [id])  // RENAMED from programme
  curriculumScheme       CurriculumScheme  @relation(fields: [curriculumSchemeId], references: [id])
  currentBatchSemester   BatchSemester?    @relation("BatchToBatchSemesterCurrent", fields: [currentBatchSemesterId], references: [id])

  batchSemesters         BatchSemester[]
  teachingGroups         TeachingGroup[]

  @@index([currentBatchSemesterId])
}
```

**Update BatchSemester:**
```
model BatchSemester {
  id             String              @id @default(cuid())
  batchId        String
  semesterNumber Int
  academicYearId String
  departmentId   String              // RENAMED from academicUnitId
  startDate      DateTime?
  endDate        DateTime?
  status         BatchSemesterStatus @default(UPCOMING)
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  batch          Batch        @relation(fields: [batchId], references: [id])
  batchCurrentOf Batch[]      @relation("BatchToBatchSemesterCurrent")
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  department     Department   @relation("batchSemesterAcademicUnit", fields: [departmentId], references: [id])  // RENAMED from academicUnit
  examCycles     ExamCycle[]

  @@unique([batchId, semesterNumber])
  @@index([academicYearId])
  @@index([departmentId])  // UPDATED from academicUnitId
}
```

### After schema change, run:
```
npx prisma generate
npx prisma migrate dev --name remove_academic_unit_programme
```

---

## C. Delete Modules (6 files, 2 directories)

Delete these files/directories entirely:
```
src/modules/academic-units/     ← entire directory (3 files)
src/modules/programmes/         ← entire directory (3 files)
```

---

## D. Delete API Routes (4 files)

```
app/api/academic-units/route.ts
app/api/academic-units/[id]/route.ts
app/api/programmes/route.ts
app/api/programmes/[id]/route.ts
```

---

## E. Delete Pages (2 files)

```
app/(protected)/dashboard/coe/academic-units/page.tsx
app/(protected)/dashboard/coe/programmes/page.tsx
```

---

## F. db-helpers.ts Changes (1 file)

### File: `src/lib/db-helpers.ts`

**Remove these 3 entries from `UNIQUE_CONSTRAINT_MESSAGES`:**
```
AcademicUnit_code_key: "An academic unit with this code already exists.",
Programme_code_key: "A programme with this code already exists.",
CurriculumScheme_programmeId_year_key: "This year already exists for this programme.",
```

**Add this 1 entry:**
```
CurriculumScheme_departmentId_year_key: "This year already exists for this department.",
```

---

## G. Service/Validation Changes (11 files)

### G1. `src/modules/batches/validation.ts`

```
Before                        → After
──────────────────────────────┼──────────────────────────────────
programmeId: z.string()...    → departmentId: z.string()...
```

### G2. `src/modules/batches/repository.ts`

```
Before                                    → After
──────────────────────────────────────────┼──────────────────────────────────────
findByProgramme(programmeId: string)       → findByDepartment(departmentId: string)
  where: { programmeId }                     where: { departmentId }

list() include:                            → list() include:
  programme: { include: {                    department: true
    homeAcademicUnit: true,
    firstYearAcademicUnit: true,
  }}

findById(id) include:                      → findById(id) include:
  programme: { include: {                    department: true,
    homeAcademicUnit: true,                   curriculumScheme: true,
    firstYearAcademicUnit: true,
  }},
  curriculumScheme: true,
  // ...rest stays                              // ...rest stays

create(data) include:                      → create(data) include:
  programme: true                             department: true
```

### G3. `src/modules/batches/service.ts`

```
Before (create method)                     → After
───────────────────────────────────────────┼────────────────────────────────────
const programme = await prisma.programme    → const department = await prisma.department
  .findUnique({                               .findUnique({
    where: { id: data.programmeId },              where: { id: data.departmentId }
    include: { homeAcademicUnit: true,         });
      firstYearAcademicUnit: true },          if (!department)
  });                                           throw new NotFoundError("Department not found");
if (!programme)                               if (!department.isActive)
  throw new NotFoundError("Programme not found"); throw new AppError("Cannot create batch for inactive
if (!programme.isActive)                        department", 400);
  throw new AppError("...");

// In transaction:                           // In transaction:
const batch = await tx.batch.create({        const batch = await tx.batch.create({
  data: {                                      data: {
    ...                                          ...
    programmeId: data.programmeId,                departmentId: data.departmentId
  },                                           },
});                                          });

// Semester generation loop:                 // Semester generation loop:
const scheme = await prisma.curriculumScheme  // (already validated earlier in the method)
  .findUnique({                                // Just read from the scheme
    where: { id: data.curriculumSchemeId },    // (scheme was already fetched for validation)
    select: { durationSemesters: true }        // Add durationSemesters to the fetch
  });
for (let sem = 1; sem <= programme            for (let sem = 1; sem <= scheme.durationSemesters;
  .durationSemesters; sem++) {                   sem++) {
  const isFirstYear = sem <= 2;
  const academicUnitId = isFirstYear             const departmentId = department.id;
    && programme.firstYearAcademicUnitId
    ? programme.firstYearAcademicUnitId
    : programme.homeAcademicUnitId;
  // ...
  semesterData.push({ ..., academicUnitId })    semesterData.push({ ..., departmentId })
```

**Parameter renames across entire file:**
```
findByProgramme(programmeId)    → findByDepartment(departmentId)
```

**Return type includes (if present):**
```
include: { programme: true }    → include: { department: true }
```

### G4. `src/modules/curriculum-schemes/validation.ts`

```
Before                                    → After
──────────────────────────────────────────┼──────────────────────────────────────
programmeId: z.string().min(1,            → departmentId: z.string().min(1,
  "Programme is required"),                  "Department is required"),
                                          → durationSemesters: z.number()
                                              .int().min(1).max(12).default(8),
```

### G5. `src/modules/curriculum-schemes/repository.ts`

```
Before                                    → After
──────────────────────────────────────────┼──────────────────────────────────────
findByProgramme(programmeId)               → findByDepartment(departmentId)
findActiveByProgramme(programmeId)          → findActiveByDepartment(departmentId)
deactivateAllForProgramme(programmeId, e?)  → deactivateAllForDepartment(departmentId, e?)

include: { programme: { include: {         → include: { department: true }
  homeAcademicUnit: true } } }
include: { programme: true }               → include: { department: true }

where: { programmeId }                     → where: { departmentId }
```

### G6. `src/modules/curriculum-schemes/service.ts`

```
Before                                    → After
──────────────────────────────────────────┼──────────────────────────────────────
findByProgramme(programmeId)               → findByDepartment(departmentId)
findActiveByProgramme(data.programmeId)     → findActiveByDepartment(data.departmentId)
findActiveByProgramme(entity.programmeId)   → findActiveByDepartment(entity.departmentId)
deactivateAllForProgramme(entity.programmeId, id)
                                            → deactivateAllForDepartment(entity.departmentId, id)
deactivateAllForProgramme(entity.programmeId, id)
                                            → deactivateAllForDepartment(entity.departmentId, id)
```

### G7. `src/modules/curriculum-subjects/validation.ts`

```
Before                                    → After
──────────────────────────────────────────┼──────────────────────────────────────
academicUnitId: z.string().min(1,          → departmentId: z.string().min(1,
  "Academic unit is required"),               "Department is required"),

// In filter schema:
academicUnitId: z.string().optional()      → departmentId: z.string().optional()
```

### G8. `src/modules/curriculum-subjects/repository.ts`

Every occurrence of `.academicUnit` in Prisma includes becomes `.department`:
```
Before:                     → After:
academicUnit: { select: {   → department: { select: {
  id: true,                    id: true,
  name: true,                  name: true,
  code: true,                  code: true,
} }                         } }
```

Search the file for `.academicUnit` or `academicUnit:` and replace each with `.department`/`department:`. There are approximately 4 occurrences.

### G9. `src/modules/curriculum-subjects/service.ts`

```
Before                                    → After
──────────────────────────────────────────┼──────────────────────────────────────
academicUnitId?: string (filter param)     → departmentId?: string (filter param)
list(filters?.academicUnitId)              → list(filters?.departmentId)

prisma.academicUnit.findUnique({           → prisma.department.findUnique({
  where: { id: data.academicUnitId }          where: { id: data.departmentId }
})                                         })
if (!unit) throw new                       → if (!dept) throw new
  NotFoundError("Academic unit not found")     NotFoundError("Department not found")
if (!unit.isActive) throw                  → if (!dept.isActive) throw
  new AppError("Cannot use an inactive       new AppError("Cannot use an inactive
    academic unit for curriculum              department for curriculum
    placement", 400)                          placement", 400)
```

Both `create()` and `createWithDepartmentCheck()` have these same changes applied twice.

### G10. `src/modules/batch-semesters/validation.ts`

```
Before                                    → After
──────────────────────────────────────────┼──────────────────────────────────────
academicUnitId: z.string().optional()     → departmentId: z.string().optional()
```

### G11. `src/modules/batch-semesters/repository.ts`

Every Prisma include/where with `academicUnit` becomes `department`:
```
Before:                     → After:
academicUnit: true           → department: true
academicUnitId               → departmentId

findActiveByAcademicUnit     → findActiveByDepartment
```

Search the file for `academicUnit` and replace all ~8 occurrences. Each is either an include (`academicUnit: true`), a where clause (`academicUnitId`), or a method name.

### G12. `src/modules/batch-semesters/service.ts`

```
Before                                    → After
──────────────────────────────────────────┼──────────────────────────────────────
findActiveByAcademicUnit(academicUnitId)   → findActiveByDepartment(departmentId)
```

### G13. `src/modules/exam-cycles/service.ts`

```
Before in create() include:               → After:
batchSemester: {                           batchSemester: {
  include: {                                 include: {
    ...                                        ...
    academicUnit: true,                        department: true,
    academicYear: true,                        academicYear: true,
  }                                          }
}                                          }

Before in return include:                  → After:
batchSemester: {                           batchSemester: {
  include: {                                 include: {
    batch: { ... },                            batch: { ... },
    academicUnit: { select: {                  department: { select: {
      id: true, name: true, code: true           id: true, name: true, code: true
    } },                                      } },
  }                                          }
}                                          }
```

### G14. `src/modules/exam-cycles/repository.ts`

Search for `academicUnit` in all includes, replace with `department`. Approximately 2-3 occurrences.

### G15. `src/modules/coordinator/question-bank.service.ts`

```
Before in getQuestionBankDetail include:   → After:
examCycle: {                               examCycle: {
  include: {                                 include: {
    batchSemester: {                           batchSemester: {
      include: {                                 include: {
        academicYear: true,                        academicYear: true,
        batch: { ... },                            batch: { ... },
        academicUnit: {                            department: {
          select: { id: true, name: true }           select: { id: true, name: true }
        },                                         },
      }                                          }
    },                                        },
  }                                        }
}                                         }
```

---

## H. API Route Changes (4 files)

### H1. `app/api/batches/route.ts`

```
Before                                    → After
──────────────────────────────────────────┼──────────────────────────────────────
const programmeId = request.nextUrl       → const departmentId = request.nextUrl
  .searchParams.get("programmeId");          .searchParams.get("departmentId");
if (programmeId) return                    → if (departmentId) return
  service.findByProgramme(programmeId);        service.findByDepartment(departmentId);
```

### H2. `app/api/curriculum-schemes/route.ts`

```
Before                                    → After
──────────────────────────────────────────┼──────────────────────────────────────
const programmeId = request.nextUrl       → const departmentId = request.nextUrl
  .searchParams.get("programmeId");          .searchParams.get("departmentId");
if (programmeId) return                    → if (departmentId) return
  service.findByProgramme(programmeId);        service.findByDepartment(departmentId);
```

### H3. `app/api/batch-semesters/route.ts`

```
Before                                    → After
──────────────────────────────────────────┼──────────────────────────────────────
const academicUnitId = request.nextUrl    → const departmentId = request.nextUrl
  .searchParams.get("academicUnitId");       .searchParams.get("departmentId");
if (academicUnitId) return                → if (departmentId) return
  service.findActiveByAcademicUnit(           service.findActiveByDepartment(
    academicUnitId);                             departmentId);
```

### H4. `app/api/curriculum-subjects/route.ts`

No code changes needed. The `curriculumSubjectFilterSchema` is parsed from search params by field name. Since the validation schema renames `academicUnitId` → `departmentId`, the search param automatically changes. No route handler change needed.

---

## I. Page Changes (10 files)

### I1. `app/(protected)/dashboard/coe/batches/page.tsx`

**Query changes:**
```
Before:                             → After:
prisma.programme.findMany(...)       → prisma.department.findMany(...)

prisma.batch.findMany({              → prisma.batch.findMany({
  include: {                           include: {
    programme: true,                     department: true,
    curriculumScheme: true,               curriculumScheme: true,
    _count: { select: {                  _count: { select: {
      batchSemesters: true                  batchSemesters: true
    } }                                   } }
  }                                    }
})                                    })
```

**Form field change:**
```
Before:                             → After:
{ name: "programmeId",               → { name: "departmentId",
  label: "Programme",                   label: "Department",
  type: "select",                       type: "select",
  options: programmes.map(...)          options: departments.map(...)
}                                     }

(Remove any homeAcademicUnitId or firstYearAcademicUnitId fields if present — they shouldn't be)
```

**Table display change:**
```
Before:                             → After:
{b.programme?.name}                  → {b.department?.name}
```

### I2. `app/(protected)/dashboard/coe/batches/[id]/page.tsx`

**Query change:**
```
Before:                             → After:
include: {                           include: {
  programme: {                         department: true,
    include: {                         curriculumScheme: true,
      homeAcademicUnit: true           // (no change needed)
    }
  },
  curriculumScheme: true
}                                    }
```

**Display changes:**
```
Before:                             → After:
batch.programme?.name                → batch.department?.name

// Remove these (they reference deleted concepts):
batch.programme?.homeAcademicUnit?.name    → REMOVE THIS ENTIRE LINE
batch.programme?.firstYearAcademicUnitId   → REMOVE THIS ENTIRE LINE
```

### I3. `app/(protected)/dashboard/coe/academic-setup/page.tsx`

```
Before:                             → After:
const unitCount = await prisma       → REMOVE THIS LINE
  .academicUnit.count()
const programmeCount = await prisma  → REMOVE THIS LINE
  .programme.count()
```

Remove the corresponding card JSX (the grid cards that display `unitCount` and `programmeCount`). The cards are typically in a grid display with `schemeCount`, `subjectCount`, `batchCount`, etc. Remove the AcademicUnits card and Programmes card.

### I4. `app/(protected)/dashboard/coe/curriculum/page.tsx`

```
Before:                             → After:
const programmes = await prisma      → const departments = await prisma
  .programme.findMany({                 .department.findMany({
    orderBy: { name: "asc" },              orderBy: { name: "asc" },
    include: { homeAcademicUnit: true }     where: { isActive: true }
  })                                    })

// Filter tabs — change from programmeId to departmentId:
href={`...?programmeId=${p.id}`}       → href={`...?departmentId=${d.id}`}

// CurriculumSubject academicUnit reference:
s.academicUnit?.name                   → s.department?.name
```

### I5. `app/(protected)/dashboard/coe/exam-cycles/page.tsx`

```
Before:                             → After:
c.batchSemester?.batch?              → c.batchSemester?.batch?
  .programme?.name                      .department?.name
c.batchSemester?.academicUnit?.name  → c.batchSemester?.department?.name
```

### I6. `app/(protected)/dashboard/coe/exam-cycles/[id]/page.tsx`

**Query change:**
```
Before:                             → After:
include: {                           include: {
  batchSemester: {                     batchSemester: {
    include: {                           include: {
      batch: {                             batch: {
        include: {                           include: {
          programme: true,                     department: true,
          curriculumScheme: true                curriculumScheme: true
        }                                    }
      },                                   },
      academicUnit: {                      department: {
        select: {                            select: {
          name: true,                          name: true,
          code: true                           code: true
        }                                    }
      },                                   },
      academicYear: {                       academicYear: {
        select: { code: true }                 select: { code: true }
      }                                    }
    }                                    }
  }                                    }
```

**Display changes:**
```
Before:                             → After:
batch?.programme?.name               → batch?.department?.name
bs?.academicUnit?.name               → bs?.department?.name
```

### I7. `app/(protected)/dashboard/coe/batches/[id]/semesters/page.tsx`

```
Before:                             → After:
sem.academicUnit?.name               → sem.department?.name

// Query change:
include: { academicYear: true,       → include: { academicYear: true,
  academicUnit: true }                   department: true }

// The breadcrumb display or header that shows programme name:
batch.programme?.name                → batch.department?.name
```

### I8. `app/(protected)/dashboard/coordinator/subjects/[id]/place-in-curriculum/page.tsx`

```
Before:                             → After:
const units = await prisma           → const departments = await prisma
  .academicUnit.findMany({              .department.findMany({
    where: { isActive: true },              where: { isActive: true },
    orderBy: { name: "asc" },               orderBy: { name: "asc" },
  })                                     })

// CurriculumScheme include:
include: { programme: {               → include: { department: { select: {
  select: { name: true }                  name: true }
}                                      } }

// Prop passed to PlacementForm:
units={units.map((u) => ({             → departments={departments.map((d) => ({
  id: u.id,                              id: d.id,
  name: u.name,                          name: d.name,
  code: u.code                           code: d.code
}))}                                   }))}

// Scheme label (was programme.name, now department.name):
schemes={schemes.map((s) => ({         → schemes={schemes.map((s) => ({
  id: s.id,                              id: s.id,
  label: `${s.name} (${s.year})          label: `${s.name} (${s.year})
    — ${s.programme.name}`                  — ${s.department.name}`
}))}                                   }))}

// CurriculumSubject query — academicUnitId filter changes automatically
// since the Prisma field is renamed. No change needed in the where clause
// if academicUnitId is used — it becomes departmentId at the Prisma level.
// But check: if the query filter uses a string literal "academicUnitId",
// it needs to change. If it uses a variable referencing the renamed Prisma field,
// it happens automatically.
```

### I9. `app/(protected)/dashboard/coordinator/subjects/[id]/place-in-curriculum/placement-form.tsx`

```
Before:                             → After:
type PlacementFormProps = {          → type PlacementFormProps = {
  subjectId: string;                     subjectId: string;
  schemes: Array<{...}>;                 schemes: Array<{...}>;
  units: Array<{...}>;                   departments: Array<{...}>;
  semesters: number[];                   semesters: number[];
};                                    };

const [unitId, setUnitId] =           → const [departmentId, setDepartmentId] =
  useState(units[0]?.id ?? "");           useState(departments[0]?.id ?? "");

// Select dropdown options:
units.map((u) => ({                   → departments.map((d) => ({
  value: u.id,                           value: d.id,
  label: `${u.name} (${u.code})`         label: `${d.name} (${d.code})`
}))                                    }))

// API payload:
body: JSON.stringify({                 body: JSON.stringify({
  ...                                     ...
  academicUnitId: unitId,                 departmentId: departmentId,
  ...                                     ...
})                                     })
```

---

## J. Seed Changes (1 file)

### J1. `prisma/seed.ts`

**Remove from imports:**
```
AcademicUnitType   ← REMOVE from the @prisma/client import list
```

**Remove these 5 lines:**
```
const eshUnit = await prisma.academicUnit.create({ data: { name: "Engineering Sciences & Humanities", code: "ESH", type: AcademicUnitType.ES_H, hodName: "Dr. First Year Incharge" } });
const compUnit = await prisma.academicUnit.create({ data: { name: "Computer Engineering", code: "COMP", type: AcademicUnitType.DEPARTMENT, hodName: "Dr. Suresh Patil" } });
const progComp = await prisma.programme.create({ data: { name: "BE Computer Engineering", code: "BECOMP", homeAcademicUnitId: compUnit.id, firstYearAcademicUnitId: eshUnit.id } });
```

**Replace AcademicUnit usage with Department upsert:**
```
const dept = await prisma.department.create({ data: { name: "Computer Engineering", code: "COMP", hodName: "Dr. Suresh Patil" } });
```
→ becomes:
```
const compDept = await prisma.department.upsert({
  where: { code: "COMP" },
  update: {},
  create: { name: "Computer Engineering", code: "COMP", hodName: "Dr. Suresh Patil" },
});

const eshDept = await prisma.department.upsert({
  where: { code: "ESH" },
  update: {},
  create: { name: "Engineering Sciences & Humanities", code: "ESH", hodName: "Dr. First Year Incharge" },
});
```

NOTE: Earlier in the seed the code does `const dept = ...` which creates the "Computer Engineering" department. The ES&H department doesn't get created separately in the original seed — it only existed as an AcademicUnit. With the upsert approach, we create both as Departments. The `dept` variable name can be reused as `dept = compDept` for all downstream references.

**Replace all `progComp.id` with `compDept.id`:**
```
programmeId: progComp.id    → departmentId: compDept.id   (CurriculumScheme)
programmeId: progComp.id    → departmentId: compDept.id   (Batch)
```

**Replace all `compUnit.id` with `compDept.id`:**
```
academicUnitId: compUnit.id → departmentId: compDept.id   (CurriculumSubject)
```

**Replace all `bd.unitId` with `compDept.id`:**
```
academicUnitId: bd.unitId   → departmentId: compDept.id   (BatchSemester)
```

**Remove `progComp` variable reference from batchSemester key computation** (if batchSemesters used progComp, they now use the department).

**Add `durationSemesters: 8` to each CurriculumScheme create:**
```
const scheme2024 = await prisma.curriculumScheme.create({
  data: {
    programmeId: progComp.id,     → departmentId: compDept.id,
    name: "2024 Scheme (CBCGS-HME 2023)",
    year: 2024,
    durationSemesters: 8,          // ← ADD THIS
  },
});
const scheme2025 = await prisma.curriculumScheme.create({
  data: {
    programmeId: progComp.id,     → departmentId: compDept.id,
    name: "2025 Scheme (CBCGS-HME 2023)",
    year: 2025,
    durationSemesters: 8,          // ← ADD THIS
  },
});
```

---

## K. Verification

Run these commands in order after completing ALL file changes:

```
# 1. Ensure Prisma schema is valid
npx prisma validate

# 2. Regenerate client with new types
npx prisma generate

# 3. Verify that no AcademicUnit or Programme types appear in generated client
# (Check node_modules/.prisma/client/index.d.ts — no AcademicUnit or Programme)

# 4. Check TypeScript compilation
npx tsc --noEmit

# 5. Build the Next.js app
npm run build

# 6. Run tests
npm test

# 7. Run seed to verify data integrity
npm run seed
```

---

## L. Open Items — Verify Before Implementation

Before implementing, check these files for any overlooked references:

- [ ] `src/modules/coordinator/subject.service.ts` — does `linkSubjectToExamCycle` or any method reference `programme` or `academicUnit`?
- [ ] `src/modules/coe/dashboard.service.ts` — does any aggregation query these models?
- [ ] `src/modules/coordinator/service.ts` — does the coordinator dashboard reference these?
- [ ] `src/components/layout/breadcrumbs.tsx` — verify we caught the `"academic-units"` and `programmes` entries
- [ ] `src/components/layout/app-shell.tsx` — verify we caught the nav items AND the `getSection()` references
- [ ] Navigation entries for "Curriculum" and "Batches" pages — are their labels already clear without Programme context?
- [ ] Tests — search for `AcademicUnit`, `academicUnit`, `Programme`, `programme` in `tests/` directory

---

## File Change Summary

| Metric | Count |
|--------|-------|
| Files deleted | 12 |
| Files modified | 35 |
| Prisma models removed | 2 |
| Prisma enums removed | 2 |
| Prisma fields renamed | 4 |
| Prisma relations renamed | 4 |
| Navigation items removed | 2 |
| Breadcrumb labels removed | 2 |
| Implementation phases | 14 |
| Compilation checkpoints | `prisma validate` → `prisma generate` → `tsc --noEmit` → `build` → `test` → `seed` |
