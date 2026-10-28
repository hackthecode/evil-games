// Пускане: node tests/run.mjs   (или на Mac без Node: jsc -m tests/run.mjs)
// В браузъра: отворете tests/index.html през локалния сървър.
if (!globalThis.crypto?.getRandomValues) {
  // JavaScriptCore няма Web Crypto – за тестовете стига и обикновен генератор
  globalThis.crypto = { getRandomValues(a) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 2 ** 32); return a; } };
}
if (!globalThis.TextEncoder) {
  // и TextEncoder (само UTF-8, колкото е нужно за хеширането)
  globalThis.TextEncoder = class { encode(str) { const b = unescape(encodeURIComponent(str)); return Uint8Array.from(b, (ch) => ch.charCodeAt(0)); } };
}
const print = globalThis.print || ((s) => console.log(s));
const { run } = await import('./all.js');
const { failed } = await run(print);
if (globalThis.process) process.exitCode = failed ? 1 : 0;
else if (failed && globalThis.quit) quit(1);
