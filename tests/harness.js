// A mini test framework without dependencies: works in Node, in JavaScriptCore (jsc) and in the browser.
const tests = [];

export function test(name, fn) { tests.push({ name, fn }); }

export class AssertError extends Error {}
export function ok(v, msg = 'expected true') { if (!v) throw new AssertError(msg); }
export function eq(a, b, msg = '') {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new AssertError(`${msg ? msg + ': ' : ''}${sa} ≠ ${sb}`);
}
export function throws(fn, re, msg = 'expected an error') {
  try { fn(); } catch (e) { if (re && !re.test(e.message)) throw new AssertError(`${msg}: „${e.message}“`); return; }
  throw new AssertError(msg);
}

/** Runs all tests; log(line) – output. Returns { passed, failed }. */
export async function run(log) {
  let passed = 0, failed = 0;
  for (const t of tests) {
    const t0 = Date.now();
    try {
      await t.fn();
      passed++;
      log(`  ✓ ${t.name} (${Date.now() - t0} ms)`);
    } catch (e) {
      failed++;
      log(`  ✗ ${t.name}\n      ${e?.message || e}${e?.stack && !(e instanceof AssertError) ? '\n      ' + String(e.stack).split('\n').slice(0, 3).join('\n      ') : ''}`);
    }
  }
  log(`
${passed} passed, ${failed} failed`);
  return { passed, failed };
}
