# TutorMatching Figma UI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved TutorMatching Figma UI as a tested React 19 application with exact local assets and responsive layouts.

**Architecture:** A Vite React application uses semantic CSS tokens and feature-owned routes. Shared primitives and the application shell encode the Figma design system once; Auth, Student, Tutor, and State screens compose those primitives without visual invention.

**Tech Stack:** React 19, TypeScript, Vite 8, React Router 7, Vitest 5, Testing Library, authored CSS.

**Spec:** `docs/superpowers/specs/2026-11-14-figma-ui-integration-design.md`

## Global Constraints

- Figma file `MPcAyOhuvLXtl3yeUVNHpd` is the only visual source of truth.
- Use local copies of every visible Figma image and SVG; no temporary Figma URLs in runtime code.
- Do not install Tailwind or substitute icons, images, copy, colors, spacing, or typography.
- React frontend calls only a typed Gateway boundary; this phase uses deterministic fixture data.
- Desktop target is 1440×900, mobile target is 390×844, tablet target is 1024×768.
- Every production behavior follows RED → GREEN → REFACTOR.

## Review Focus

- Direct navigation to every route must render the intended screen rather than a blank shell.
- Mobile and tablet navigation must remain usable without horizontal overflow.
- Auth inputs and password visibility must remain keyboard-operable and visibly focused.
- Missing or slow images must preserve the Figma slot dimensions and avoid layout shift.
- Navigation, modal, toast, filter, and role states must expose text or semantics beyond color alone.

---

### Task 1: Application Foundation and Design Tokens

**Files:**
- Create: `src/Web/TutorMatching.Web/package.json`
- Create: `src/Web/TutorMatching.Web/vite.config.ts`
- Create: `src/Web/TutorMatching.Web/src/app/App.tsx`
- Create: `src/Web/TutorMatching.Web/src/app/routes.tsx`
- Create: `src/Web/TutorMatching.Web/src/design-system/tokens.css`
- Create: `src/Web/TutorMatching.Web/src/design-system/base.css`
- Test: `src/Web/TutorMatching.Web/src/app/App.test.tsx`

**Interfaces:**
- Produces: `App`, `appRoutes`, CSS variables, global reset, and test/build scripts used by all later tasks.

- [ ] Write `App.test.tsx` asserting the root route redirects to `/auth/sign-in` and an unknown route renders the 404 state.
- [ ] Run `npm test -- --run src/app/App.test.tsx`; expect failure because the app does not exist.
- [ ] Scaffold Vite/React, define tokens from Figma Foundations, and implement the router shell.
- [ ] Run the focused test and full suite; expect pass.
- [ ] Commit foundation files.

### Task 2: Exact Figma Assets and Shared Primitives

**Files:**
- Create: `src/Web/TutorMatching.Web/public/assets/figma/*`
- Create: `src/Web/TutorMatching.Web/src/design-system/Button.tsx`
- Create: `src/Web/TutorMatching.Web/src/design-system/TextField.tsx`
- Create: `src/Web/TutorMatching.Web/src/design-system/StatusBadge.tsx`
- Create: `src/Web/TutorMatching.Web/src/design-system/Surface.tsx`
- Test: `src/Web/TutorMatching.Web/src/design-system/primitives.test.tsx`

**Interfaces:**
- Produces: `Button`, `TextField`, `StatusBadge`, `Surface`, and stable `/assets/figma/*` asset URLs.

- [ ] Write failing tests for labels, disabled state, password control, and non-color badge text.
- [ ] Download the exact Figma assets and verify every file is non-empty.
- [ ] Implement primitives from Components page `16:117` and token bindings.
- [ ] Run focused tests and asset integrity check; expect pass.
- [ ] Commit assets and primitives.

### Task 3: Authentication Flow

**Files:**
- Create: `src/Web/TutorMatching.Web/src/features/auth/AuthLayout.tsx`
- Create: `src/Web/TutorMatching.Web/src/features/auth/AuthRoutes.tsx`
- Create: `src/Web/TutorMatching.Web/src/features/auth/auth.css`
- Test: `src/Web/TutorMatching.Web/src/features/auth/AuthRoutes.test.tsx`

**Interfaces:**
- Consumes: Task 1 router and Task 2 primitives/assets.
- Produces: nine `/auth/*` routes matching Figma nodes `19:117` through `19:329`.

- [ ] Write failing route tests for sign-in, sign-up, forgot/reset password, email verification, role choice, expired session, and sign-in error.
- [ ] Implement the shared 720/720 layout, exact carousel, copy, forms, and state-specific content.
- [ ] Add role toggle, password visibility, form states, and keyboard-operable carousel controls without changing default screenshots.
- [ ] Run auth tests and desktop/mobile screenshot comparisons; expect pass.
- [ ] Commit auth flow.

### Task 4: Student Application

**Files:**
- Create: `src/Web/TutorMatching.Web/src/shared/AppShell.tsx`
- Create: `src/Web/TutorMatching.Web/src/features/student/StudentRoutes.tsx`
- Create: `src/Web/TutorMatching.Web/src/features/student/student.css`
- Create: `src/Web/TutorMatching.Web/src/shared/fixtures.ts`
- Test: `src/Web/TutorMatching.Web/src/features/student/StudentRoutes.test.tsx`

**Interfaces:**
- Consumes: app shell, primitives, local assets.
- Produces: twelve `/student/*` routes and the responsive bottom navigation.

- [ ] Write failing tests for dashboard, tutor search/filtering, profile, schedule selection, booking review/confirmation, bookings, notifications, profile, and settings.
- [ ] Implement the desktop shell and all Student frames `20:117`–`20:1088` with deterministic fixture content.
- [ ] Implement 390px and 1024px layouts from Responsive page `23:117`.
- [ ] Run Student tests and visual comparisons for dashboard, find tutors, tutor profile, mobile find tutors, and tablet dashboard.
- [ ] Commit Student application.

### Task 5: Tutor Application

**Files:**
- Create: `src/Web/TutorMatching.Web/src/features/tutor/TutorRoutes.tsx`
- Create: `src/Web/TutorMatching.Web/src/features/tutor/tutor.css`
- Test: `src/Web/TutorMatching.Web/src/features/tutor/TutorRoutes.test.tsx`

**Interfaces:**
- Consumes: shared shell, primitives, fixtures, and assets.
- Produces: ten `/tutor/*` routes matching Figma nodes `21:117`–`21:637`.

- [ ] Write failing tests for dashboard, onboarding, subjects/pricing, availability, requests, schedule, lesson details, public profile, notifications, and settings.
- [ ] Implement all Tutor compositions and exact active navigation states.
- [ ] Implement form, schedule, availability, and review interactions while preserving default Figma states.
- [ ] Run Tutor tests and desktop visual comparisons; expect pass.
- [ ] Commit Tutor application.

### Task 6: Shared States and Responsive Hardening

**Files:**
- Create: `src/Web/TutorMatching.Web/src/features/states/StateGallery.tsx`
- Create: `src/Web/TutorMatching.Web/src/features/states/states.css`
- Test: `src/Web/TutorMatching.Web/src/features/states/StateGallery.test.tsx`

**Interfaces:**
- Produces: sixteen `/states/*` routes and reusable modal/toast/empty/error treatments.

- [ ] Write failing tests for loading, empty, offline, 403, 404, 500, conflict, success, expired, rate-limit, maintenance, confirmation, validation, toast, and hold countdown states.
- [ ] Implement nodes `22:117`–`22:246` with the exact vectors, copy, and card geometry.
- [ ] Audit all routes at 390, 768, 1024, and 1440 widths for overflow and target size.
- [ ] Run focused tests and full suite; expect pass.
- [ ] Commit shared states and responsive fixes.

### Task 7: Visual Regression, Build, and Handoff

**Files:**
- Create: `src/Web/TutorMatching.Web/tests/visual/*.spec.ts`
- Create: `src/Web/TutorMatching.Web/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: every route and Figma reference screenshot.
- Produces: reproducible test/build/preview commands and final visual evidence.

- [ ] Add browser smoke/visual tests for representative desktop, mobile, and tablet routes.
- [ ] Compare screenshots against current Figma renders and fix every in-scope mismatch.
- [ ] Run `npm test`, `npm run build`, and browser smoke tests; expect zero failures.
- [ ] Verify every referenced asset exists, is non-empty, and has a matching rendered slot.
- [ ] Document local commands and commit final integration.
