# Copilot Instructions for TimeplanEz

## Project Overview
- This is a Vite + React + TypeScript app backed by Supabase.
- Keep changes focused, minimal, and consistent with the existing codebase.
- Prefer readability and correctness over clever abstractions.

## General Coding Rules
- Use TypeScript-friendly patterns and keep types explicit when helpful.
- Preserve existing public APIs and UI behavior unless the user asks for a change.
- Avoid unrelated refactors, formatting churn, or renaming unless necessary.
- Prefer `apply_patch` for code edits.
- Do not delete user data or existing features unless explicitly requested.

## UI and UX Rules
- Keep the app responsive and mobile-friendly.
- Maintain the existing visual language unless a redesign is requested.
- For forms and settings pages, prefer clear sectioning and obvious save actions.
- Make destructive actions explicit and safe.

## Reflections and Hours Rules
- Reflections are shared per day, not per shift.
- A single date should have one reflection note that applies to all shifts on that date.
- Exports should reflect day-based reflection data when relevant.
- When editing or deleting a reflection, apply the change to all shifts on that date.

## Supabase and Data Rules
- Keep Supabase schema changes in migrations.
- Prefer defensive handling for optional or missing columns.
- Keep date and numeric handling consistent across the app and database.

## Validation
- After code changes, prefer running `npm run build` to validate the result.
- If a change affects data flow or UI behavior, verify the touched path directly.
