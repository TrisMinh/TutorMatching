# TutorMatching Figma UI Integration Design

## Intent

Implement the finalized TutorMatching Figma file `MPcAyOhuvLXtl3yeUVNHpd` as the real React frontend. The Figma frames are the visual source of truth: layout, dimensions, typography, color, spacing, imagery, icons, copy, responsive behavior, and visible states must be reproduced without adding unapproved visual patterns.

## Goals

- Deliver a React 19 + TypeScript web application covering the Auth, Student, Tutor, Shared State, and responsive reference frames.
- Preserve the Figma blue/navy/Gilroy design system and exact static assets downloaded from Figma.
- Provide real form, navigation, filter, tab, modal, toast, and carousel interactions while keeping the rendered default states visually identical to Figma.
- Make desktop, 390px mobile, and 1024px tablet layouts match their corresponding Figma frames.
- Keep API access behind a typed Gateway client so mock data can be replaced without redesigning components.

## Non-goals

- Backend services, authentication persistence, payments, chat, video calls, or live API integration.
- Visual redesign, new copy, alternative imagery, or substitute icon families.
- Publishing or deploying the site in this integration phase.

## Constraints

- Stack: React 19, TypeScript, Vite, React Router, Vitest, Testing Library.
- Styling: authored CSS and semantic CSS variables; Tailwind is not added.
- Static assets: use non-empty local files downloaded from Figma; temporary Figma URLs are forbidden at runtime.
- Fonts: use the Figma Gilroy family when available locally and provide metric-compatible fallbacks without changing the type scale.
- Accessibility: semantic controls, visible focus, labels, keyboard operation, reduced-motion support, and non-color state indicators.
- Source design pages: Foundations `12:117`, Components `16:117`, Auth `16:118`, Student `16:119`, Tutor `16:120`, Shared States `16:121`, Responsive `23:117`.

## Architecture

Use a feature-first frontend under `src/Web/TutorMatching.Web`. `app/` owns routing and providers; `design-system/` owns tokens and primitives; `features/auth`, `features/student`, `features/tutor`, and `features/states` own screen composition; `shared/` owns shell, navigation, mock models, and the future Gateway client. Routes render shared desktop shells and switch to the Figma mobile/tablet compositions at the documented breakpoints.

## Approved approach

The approved Figma file is the design document, so implementation follows one approach only: reconstruct semantic React layouts from high-fidelity Figma context and verify them against Figma screenshots. Full-screen raster screenshots are never used as implementation assets.

## Success criteria

- Every implemented route renders without console errors and has a focused behavioral test.
- All visible Figma images and SVGs resolve from local assets with correct effective geometry.
- Visual comparison at 1440×900, 390×844, and 1024×768 shows no missing sections, substituted assets, or invented styling.
- `npm test`, `npm run build`, and the browser smoke suite pass.
