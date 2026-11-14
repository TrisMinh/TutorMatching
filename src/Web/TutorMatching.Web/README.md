# TutorMatching Web

High-fidelity React implementation of the approved TutorMatching Figma file
`MPcAyOhuvLXtl3yeUVNHpd`. The implementation uses local Figma exports, Gilroy,
React Router, authored responsive CSS, and deterministic fixture content.

The UI motion system is defined in `src/design-system/motion.css`. It uses shared
duration/easing tokens, native View Transitions where supported, transform/opacity
micro-interactions, and a complete `prefers-reduced-motion` fallback.

## Run locally

```powershell
npm install
npm run dev
```

Vite serves the application at `http://localhost:5173` by default.

## Verification

```powershell
npm run test:run
npm run test:visual
npm run build
```

- Unit and interaction coverage includes all Auth, Student, Tutor, and shared-state routes.
- Browser visual contracts cover the Figma desktop (1440×900), tablet (1024×768),
  mobile (390×844), and shared-state (480×360) canvases.
- Browser tests use the installed stable Chrome channel and start a dedicated Vite server on port 4173.
- Motion contracts cover page entry, carousel changes, native route transitions,
  and reduced-motion behavior.

## Route groups

- `/auth/*` — 9 authentication and account states.
- `/student/*` — 12 student application screens.
- `/tutor/*` — 10 tutor application screens.
- `/states/*` — 16 loading, empty, error, confirmation, validation, toast, and hold states.

All production images, icons, brand marks, and fonts are stored under
`public/assets/figma`; the runtime does not depend on expiring Figma asset URLs.
