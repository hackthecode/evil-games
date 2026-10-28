// Run: node tests/run.mjs   (or on a Mac without Node: jsc -m tests/run.mjs)
// In the browser: open tests/index.html via the local server.
if (!globalThis.crypto?.getRandomValues) {
  // JavaScriptCore has no Web Crypto – a plain generator is enough for the tests
  globalThis.crypto = { getRandomValues(a) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 2 ** 32); return a; } };
}
if (!globalThis.TextEncoder) {
  // and TextEncoder (UTF-8 only, as much as hashing needs)
  globalThis.TextEncoder = class { encode(str) { const b = unescape(encodeURIComponent(str)); return Uint8Array.from(b, (ch) => ch.charCodeAt(0)); } };
}
const print = globalThis.print || ((s) => console.log(s));
const { run } = await import('./all.js');
const { failed } = await run(print);
if (globalThis.process) process.exitCode = failed ? 1 : 0;
else if (failed && globalThis.quit) quit(1);
