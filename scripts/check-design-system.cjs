const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const stylesheetPath = resolve(
  __dirname,
  '..',
  'apps',
  'desktop',
  'src',
  'renderer',
  'styles.css',
);
const stylesheet = readFileSync(stylesheetPath, 'utf8');

const forbiddenLiterals = [
  { label: 'color', pattern: /#[\da-f]{3,8}\b|rgba?\([^)]*\)/giu },
  { label: 'font size', pattern: /font-size:\s*\d+(?:\.\d+)?px/giu },
  { label: 'font weight', pattern: /font-weight:\s*\d{3}\b/giu },
  {
    label: 'border radius',
    pattern: /border-radius:\s*\d+(?:\.\d+)?(?:px|%)/giu,
  },
  { label: 'gap', pattern: /(?:^|[;{])\s*gap:\s*\d+(?:\.\d+)?px/gimu },
  {
    label: 'shadow',
    pattern: /box-shadow:(?![ \t]*var\()[^;]+/giu,
  },
];

const violations = forbiddenLiterals.flatMap(({ label, pattern }) =>
  [...stylesheet.matchAll(pattern)].map((match) => ({
    label,
    line: stylesheet.slice(0, match.index).split('\n').length,
    value: match[0].trim(),
  })),
);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(
      `styles.css:${violation.line}: raw ${violation.label} token: ${violation.value}`,
    );
  }
  console.error(
    'Add or reuse a token in design-system.css instead of a component literal.',
  );
  process.exitCode = 1;
} else {
  console.log('Component styles use design-system tokens.');
}
