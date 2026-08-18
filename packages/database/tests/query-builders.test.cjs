const assert = require('node:assert/strict');
const test = require('node:test');
const { inClausePlaceholders } = require('../dist/query-builders');

test('query-builders creates placeholders only for non-empty lists', () => {
  assert.equal(inClausePlaceholders(1), '?');
  assert.equal(inClausePlaceholders(3), '?, ?, ?');
  assert.throws(() => inClausePlaceholders(0), RangeError);
  assert.throws(() => inClausePlaceholders(1.5), RangeError);
});
