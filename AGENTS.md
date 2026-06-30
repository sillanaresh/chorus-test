# Agent guide

This file is for coding agents working in this repository. It is the short version. The long onboarding for Claude is in `CLAUDE.md`, and the product and architecture details are in `README.md`.

## What this repository is

This is a personal fork of Chorus. The remote `fork` (github.com/sillanaresh/chorus-test) is the project we work on. The remote `origin` (github.com/meltylabs/chorus) is the open-source upstream. Always push to `fork`, never to `origin`.

The fork adds an iPhone app on top of the upstream desktop app. The new parts are the mobile UI, a private on-device memory layer, voice input, pin and export, share, and custom colors.

## Push and branch rules

- Push to `fork`. Do not push to `origin`.
- Do not commit to `main` directly during normal work. Use a branch, then push.
- When the owner asks to publish, push the branch to `fork/main`.
- End commit messages with the Co-Authored-By line the harness provides.

## How to run and build

- macOS app: `pnpm run dev`
- iPhone simulator: `VITE_CHORUS_MOBILE=1 pnpm tauri ios dev "iPhone 17"`
- Sideloadable iPhone app: `./script/build-unsigned-ipa.sh`. It writes `Chorus-unsigned.ipa` at the repo root, and you can override the path with `OUT_IPA`. This build is self-contained, so it needs no dev server.
- Checks: `pnpm run build && pnpm run lint && pnpm run test`.

If the app in the simulator shows a screen that says it could not connect to `http://localhost:1420`, you are running a debug build with no dev server. A debug build loads the UI from the dev server. Use the build script above for a standalone app, or start the dev server with the simulator command.

## Where things live

- Mobile UI: `src/ui/components/mobile/MobileApp.tsx`. The shared composer is `src/ui/components/ChatInput.tsx`.
- Core logic and data: `src/core/chorus/api/` (TanStack Query) and `src/core/chorus/db/`.
- Memory: `src/core/chorus/api/MemoryAPI.ts`.
- Native shell and migrations: `src-tauri/`.
- Database schema reference: `SQL_SCHEMA.md`.

## Conventions

- TypeScript is strict. Avoid `as` and prefer real types.
- Use the path aliases `@ui/*`, `@core/*`, and `@/*`.
- Prefer `undefined` to `null`. Convert a null from the database to `undefined`.
- Do not add foreign keys or other database constraints.
- Mobile uses OpenRouter for chat and OpenAI for memory and voice.
- The owner is cost-conscious. Be decisive and do not re-ask settled questions.

## Work in progress

A native iOS background task that uses `UIApplication.beginBackgroundTask` is written but not merged. It is saved as the git tag `native-bg-wip`. It is blocked on a coordinated Tauri dependency upgrade and needs a physical device to verify. The shipped version keeps replies running in the background with a silent audio session instead.
