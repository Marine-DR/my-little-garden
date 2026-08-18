const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const designSystemPath = resolve(
  root,
  'apps/desktop/src/renderer/design-system.css',
);
const stylesheetPath = resolve(root, 'apps/desktop/src/renderer/styles.css');
const runtimeTokensPath = resolve(
  root,
  'apps/desktop/src/shared/design-tokens.ts',
);
const designSystem = readFileSync(designSystemPath, 'utf8');
const stylesheet = readFileSync(stylesheetPath, 'utf8');
const runtimeTokens = readFileSync(runtimeTokensPath, 'utf8');

const tokenEntries = [...designSystem.matchAll(/(--[\w-]+):\s*([^;]+);/gu)].map(
  (match) => [match[1], match[2].trim()],
);
const tokens = new Map(tokenEntries);
const errors = [];

if (tokens.size !== tokenEntries.length) {
  errors.push('design-system.css contains duplicate token declarations.');
}

const referencedTokens = [
  ...stylesheet.matchAll(/var\((--[\w-]+)\)/gu),
  ...designSystem.matchAll(/var\((--[\w-]+)\)/gu),
].map((match) => match[1]);

for (const token of new Set(referencedTokens)) {
  if (!tokens.has(token)) {
    errors.push(`Referenced token ${token} is not declared.`);
  }
}

const runtimeEntries = [
  ...runtimeTokens.matchAll(
    /\w+:\s*(['"])(.*?)\1,\s*\/\/\s*design-token:\s*(--[\w-]+)/gu,
  ),
].map((match) => ({ value: match[2], token: match[3] }));
const runtimeColorLiteralCount = [
  ...runtimeTokens.matchAll(/(['"])(?:#[\da-f]{3,8}|rgba?\([^)]*\))\1/giu),
].length;

if (runtimeColorLiteralCount !== runtimeEntries.length) {
  errors.push(
    'Every runtime color literal must have a design-token annotation.',
  );
}

for (const { token, value } of runtimeEntries) {
  const cssValue = tokens.get(token);
  if (!cssValue) {
    errors.push(`Runtime counterpart references missing token ${token}.`);
  } else if (cssValue !== value) {
    errors.push(
      `${token} differs between CSS (${cssValue}) and TypeScript (${value}).`,
    );
  }
}

const usedTokens = new Set([
  ...referencedTokens,
  ...runtimeEntries.map(({ token }) => token),
]);
for (const token of tokens.keys()) {
  if (!usedTokens.has(token)) {
    errors.push(`Unused design token ${token}.`);
  }
}

const forbiddenComponentLiterals = [
  { label: 'pixel value', pattern: /\b\d+(?:\.\d+)?px\b/giu },
  { label: 'color', pattern: /#[\da-f]{3,8}\b|rgba?\([^)]*\)/giu },
  { label: 'font weight', pattern: /font-weight:\s*\d{3}\b/giu },
  {
    label: 'shadow',
    pattern: /box-shadow:(?![ \t]*var\()[^;]+/giu,
  },
  {
    label: 'spacing value',
    pattern:
      /(?:margin|padding|gap|row-gap|column-gap)(?:-[\w-]+)?:\s*[^;]*\b\d+(?:\.\d+)?(?:rem|em)\b/giu,
  },
];

for (const { label, pattern } of forbiddenComponentLiterals) {
  for (const match of stylesheet.matchAll(pattern)) {
    const line = stylesheet.slice(0, match.index).split('\n').length;
    errors.push(
      `styles.css:${line}: raw ${label}: ${match[0].trim()}. Use a design token.`,
    );
  }
}

if (/--(?:color-)?planner-/u.test(designSystem)) {
  errors.push(
    'Feature-specific planner tokens are not part of the shared system.',
  );
}

const expectedSpacingScale = new Map([
  ['--space-2', '2px'],
  ['--space-4', '4px'],
  ['--space-8', '8px'],
  ['--space-12', '12px'],
  ['--space-16', '16px'],
  ['--space-20', '20px'],
  ['--space-24', '24px'],
  ['--space-32', '32px'],
]);
for (const [token, value] of expectedSpacingScale) {
  if (tokens.get(token) !== value) {
    errors.push(`Spacing scale requires ${token}: ${value}.`);
  }
}
for (const token of tokens.keys()) {
  if (token.startsWith('--space-') && !expectedSpacingScale.has(token)) {
    errors.push(`Unexpected spacing token outside the shared scale: ${token}.`);
  }
}

const fixedSemanticColors = new Map([
  ['--color-exposure-sun', '#edb254'],
  ['--color-exposure-shade', '#000000'],
]);
for (const [token, value] of fixedSemanticColors) {
  if (tokens.get(token) !== value) {
    errors.push(`Semantic color requires ${token}: ${value}.`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(
    `Design system valid: ${tokens.size} used tokens; ${runtimeEntries.length} runtime counterparts match CSS.`,
  );
}
