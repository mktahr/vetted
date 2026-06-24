// scripts/ts-test-register.mjs
//
// Registers the extensionless-.ts resolver hook for `node --test`. Use via:
//   node --test --import ./scripts/ts-test-register.mjs lib/network/*.test.mjs
// (wired as the `test:network` npm script).

import { register } from 'node:module';
register('./ts-test-resolver.mjs', import.meta.url);
