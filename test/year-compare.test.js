import { test, expect } from 'bun:test';

// Import the COMPILED dist/green-radius.js, not the .jsx source: Bun's dynamic
// import() applies its own automatic-JSX-runtime transform to any .jsx file
// that contains JSX, and that transform is incompatible with the file also
// referencing `module`/`module.exports` (the same isomorphic-export guard
// src/core.jsx and result-state.js use) — it throws
// "SyntaxError: Unexpected token '{'. import call expects one or two
// arguments." at parse time. green-radius.jsx is full of JSX (unlike
// src/core.jsx, which has none and imports fine directly), so it hits this.
// The compiled dist/ artifact has already been transpiled to plain
// React.createElement calls with no JSX left, so it imports cleanly — and CI's
// "Compile gate" step always rebuilds dist/ before "Unit tests" runs, so it's
// current. Run `bun run scripts/build.js` before `bun test` locally.
const { extractResultToken } = (await import('../dist/green-radius.js')).default;

test('extractResultToken: full URL with ?r= query param', () => {
  const token = extractResultToken('https://greenradi.us/result/?r=eyJ2IjoyfQ');
  expect(token).toBe('eyJ2IjoyfQ');
});

test('extractResultToken: legacy full URL with #hash payload', () => {
  const token = extractResultToken('https://greenradi.us/result/#eyJ2IjoyfQ');
  expect(token).toBe('#eyJ2IjoyfQ'); // ResultState.decode strips the leading '#' itself
});

test('extractResultToken: bare payload (no URL wrapper) passes through unchanged', () => {
  const token = extractResultToken('eyJ2IjoyLCJjIjoiRHVzdHkifQ');
  expect(token).toBe('eyJ2IjoyLCJjIjoiRHVzdHkifQ');
});

test('extractResultToken: whitespace-padded input is trimmed', () => {
  expect(extractResultToken('  eyJ2IjoyfQ  ')).toBe('eyJ2IjoyfQ');
});

test('extractResultToken: empty/garbage input never throws', () => {
  expect(extractResultToken('')).toBe('');
  expect(extractResultToken(null)).toBe('');
  expect(() => extractResultToken('not a real link at all')).not.toThrow();
});
