// scripts/ts-test-resolver.mjs
//
// Test-only module-resolution hook. App code imports TS modules extensionless
// (./scopes) for Next/tsc; Node's native TS test runner needs the explicit
// .ts extension. This hook rewrites extensionless relative specifiers to .ts
// when such a file exists, so `node --test` can run .mjs tests that import the
// real .ts modules without changing app import style. Registered via
// scripts/ts-test-register.mjs. Not part of the Next build.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(mjs|cjs|js|ts|mts|cts|json)$/.test(specifier)) {
    try {
      const candidate = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    } catch {
      // fall through to default resolution
    }
  }
  return nextResolve(specifier, context);
}
