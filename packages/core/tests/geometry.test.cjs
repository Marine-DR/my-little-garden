const assert = require('node:assert/strict');
const test = require('node:test');
const {
  circlesOverlap,
  clampPointToRectangle,
  rectangleContainsCircle,
  rectangleContainsRectangle,
} = require('../dist');

const bed = { xCm: 0, yCm: 0, widthCm: 200, heightCm: 100 };

test('checks top-down geometry in centimetres', () => {
  assert.equal(
    rectangleContainsRectangle(bed, {
      xCm: 10,
      yCm: 10,
      widthCm: 180,
      heightCm: 80,
    }),
    true,
  );
  assert.equal(
    rectangleContainsRectangle(bed, {
      xCm: 10,
      yCm: 10,
      widthCm: 200,
      heightCm: 80,
    }),
    false,
  );
  assert.equal(
    rectangleContainsCircle(bed, { xCm: 25, yCm: 25, radiusCm: 25 }),
    true,
  );
  assert.equal(
    rectangleContainsCircle(bed, { xCm: 10, yCm: 25, radiusCm: 25 }),
    false,
  );
});

test('detects overlapping plant circles and clamps points', () => {
  assert.equal(
    circlesOverlap(
      { xCm: 25, yCm: 25, radiusCm: 20 },
      { xCm: 60, yCm: 25, radiusCm: 20 },
    ),
    true,
  );
  assert.equal(
    circlesOverlap(
      { xCm: 20, yCm: 20, radiusCm: 20 },
      { xCm: 60, yCm: 20, radiusCm: 20 },
    ),
    false,
  );
  assert.deepEqual(clampPointToRectangle({ xCm: -5, yCm: 120 }, bed), {
    xCm: 0,
    yCm: 100,
  });
});
