import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import type { Plan, PlanLesson, PlanScreen, PlanShape } from './types';

const H1_RE = /^# (.+)$/;
const H2_RE = /^## Lesson (\d+)\s*[—-]\s*(.+)$/;
const ONBOARDING_H2_RE = /^## Onboarding\s*$/;
const SCREEN_RE = /^- Screen (\d+):\s*(.+)$/;
const ANY_H_RE = /^#{1,6}\s/;

const SOFT_MAX_LESSONS = 12;
const SOFT_MAX_SCREENS_PER_LESSON = 15;
const SOFT_MAX_ONBOARDING = 5;

function fail(message: string): never {
  console.error(`\x1b[31m✖ plan invalid:\x1b[0m ${message}`);
  process.exit(1);
}

function ok(message: string): void {
  console.log(`\x1b[32m✓ plan ok:\x1b[0m ${message}`);
}

function warn(message: string): void {
  console.log(`\x1b[33m⚠ plan warning:\x1b[0m ${message}`);
}

interface LineEntry { lineNo: number; text: string }

type Section = 'onboarding' | 'lesson' | null;

function parse(input: string): Plan {
  const lines: LineEntry[] = input.split(/\r?\n/).map((text, i) => ({ lineNo: i + 1, text }));

  let courseTitle: string | null = null;
  let courseTitleLine = -1;
  let intro: string | null = null;
  const lessons: PlanLesson[] = [];
  let currentLesson: PlanLesson | null = null;
  let currentSection: Section = null;
  let topLevelScreens: PlanScreen[] = [];
  const onboarding: PlanScreen[] = [];
  let sawAnyLesson = false;
  let sawTopLevelScreen = false;
  let sawOnboarding = false;
  let onboardingLine = -1;

  for (const { lineNo, text } of lines) {
    const trimmed = text.trim();
    if (trimmed === '') continue;

    const h1 = trimmed.match(H1_RE);
    if (h1) {
      if (courseTitle !== null) {
        fail(`line ${lineNo}: multiple H1 headings — only one course title allowed (first was line ${courseTitleLine})`);
      }
      if (!h1[1].trim()) fail(`line ${lineNo}: H1 has empty title`);
      courseTitle = h1[1].trim();
      courseTitleLine = lineNo;
      continue;
    }

    if (courseTitle === null) {
      fail(`line ${lineNo}: content before any H1 course title — the first non-empty line must be "# <title>"`);
    }

    const onboardingH2 = trimmed.match(ONBOARDING_H2_RE);
    if (onboardingH2) {
      if (sawOnboarding) {
        fail(`line ${lineNo}: multiple "## Onboarding" sections — only one allowed (first was line ${onboardingLine})`);
      }
      if (sawAnyLesson) {
        fail(`line ${lineNo}: "## Onboarding" appears after a "## Lesson" section — onboarding must come first`);
      }
      if (sawTopLevelScreen) {
        fail(`line ${lineNo}: "## Onboarding" appears after top-level "- Screen" bullets — onboarding must come before any bullets`);
      }
      sawOnboarding = true;
      onboardingLine = lineNo;
      currentSection = 'onboarding';
      continue;
    }

    const h2 = trimmed.match(H2_RE);
    if (h2) {
      if (sawTopLevelScreen) {
        fail(`line ${lineNo}: H2 lesson appears after a top-level "- Screen" bullet — pick one shape: lessons OR screens-only`);
      }
      const n = parseInt(h2[1], 10);
      const expected = lessons.length + 1;
      if (n !== expected) {
        fail(`line ${lineNo}: lesson number ${n} but expected ${expected} (lesson numbers must be sequential 1..K, no gaps)`);
      }
      const title = h2[2].trim();
      if (!title) fail(`line ${lineNo}: lesson ${n} has empty title`);
      currentLesson = { n, title, screens: [] };
      lessons.push(currentLesson);
      sawAnyLesson = true;
      currentSection = 'lesson';
      continue;
    }

    const screen = trimmed.match(SCREEN_RE);
    if (screen) {
      const n = parseInt(screen[1], 10);
      const synopsis = screen[2].trim();
      if (!synopsis) fail(`line ${lineNo}: screen ${n} has empty synopsis`);

      if (currentSection === 'onboarding') {
        const expected = onboarding.length + 1;
        if (n !== expected) {
          fail(`line ${lineNo}: onboarding screen number ${n} but expected ${expected} (sequential 1..K within onboarding section)`);
        }
        onboarding.push({ n, synopsis });
      } else if (currentSection === 'lesson' && currentLesson) {
        const expected = currentLesson.screens.length + 1;
        if (n !== expected) {
          fail(`line ${lineNo}: screen number ${n} in lesson ${currentLesson.n} but expected ${expected} (screen numbers must be sequential 1..M within a lesson)`);
        }
        currentLesson.screens.push({ n, synopsis });
      } else {
        if (sawAnyLesson) {
          fail(`line ${lineNo}: top-level "- Screen" bullet appears after H2 lessons — pick one shape: lessons OR screens-only`);
        }
        const expected = topLevelScreens.length + 1;
        if (n !== expected) {
          fail(`line ${lineNo}: screen number ${n} but expected ${expected} (screen numbers must be sequential 1..M)`);
        }
        topLevelScreens.push({ n, synopsis });
        sawTopLevelScreen = true;
      }
      continue;
    }

    if (ANY_H_RE.test(trimmed)) continue;

    if (intro === null && !sawAnyLesson && !sawTopLevelScreen && !sawOnboarding) {
      intro = trimmed;
    }
  }

  if (courseTitle === null) fail('missing H1 course title — the first non-empty line must be "# <title>"');

  let shape: PlanShape;
  let outLessons: PlanLesson[];

  if (sawAnyLesson) {
    shape = 'with-lessons';
    for (const lesson of lessons) {
      if (lesson.screens.length === 0) {
        fail(`lesson ${lesson.n} ("${lesson.title}") has no screens — each lesson must have ≥1 screen`);
      }
    }
    if (lessons.length === 0) fail('no lessons parsed despite H2 markers — internal validator error');
    outLessons = lessons;
  } else if (sawTopLevelScreen) {
    shape = 'screens-only';
    outLessons = [{ n: 1, title: null, screens: topLevelScreens }];
  } else {
    fail('no lessons or screens found — plan must have at least one "## Lesson N — ..." or one "- Screen N: ..." bullet');
  }

  if (sawOnboarding && onboarding.length === 0) {
    fail(`"## Onboarding" section has no screens — remove the section or add at least one "- Screen N: ..." bullet`);
  }

  if (outLessons.length > SOFT_MAX_LESSONS) {
    warn(`${outLessons.length} lessons — soft cap is ${SOFT_MAX_LESSONS}; consider splitting`);
  }
  for (const lesson of outLessons) {
    if (lesson.screens.length > SOFT_MAX_SCREENS_PER_LESSON) {
      const label = lesson.title === null ? `top-level` : `lesson ${lesson.n}`;
      warn(`${label} has ${lesson.screens.length} screens — soft cap is ${SOFT_MAX_SCREENS_PER_LESSON}`);
    }
  }
  if (onboarding.length > SOFT_MAX_ONBOARDING) {
    warn(`${onboarding.length} onboarding screens — soft cap is ${SOFT_MAX_ONBOARDING}`);
  }

  return { shape, courseTitle, intro, onboarding, lessons: outLessons };
}

function main(): void {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? 'tmp/luly-agent/plan.md');

  if (!existsSync(inputPath)) {
    fail(`file not found: ${inputPath}`);
  }

  const text = readFileSync(inputPath, 'utf8');
  const plan = parse(text);

  const sidecarPath = join(dirname(inputPath), 'plan.parsed.json');
  writeFileSync(sidecarPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');

  const totalScreens = plan.lessons.reduce((sum, l) => sum + l.screens.length, 0);
  ok(`${inputPath}`);
  console.log(`  shape        = ${plan.shape}`);
  console.log(`  courseTitle  = ${plan.courseTitle}`);
  console.log(`  onboarding   = ${plan.onboarding.length} screen(s)`);
  console.log(`  lessons      = ${plan.shape === 'screens-only' ? '(implicit)' : plan.lessons.length}`);
  console.log(`  screens      = ${totalScreens}`);
  console.log(`  parsed       → ${sidecarPath}`);
}

main();
