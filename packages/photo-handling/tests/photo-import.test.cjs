const assert = require('node:assert/strict');
const test = require('node:test');
const { importPlantPhotos } = require('../dist');

function dependencies({ failUpsert = false } = {}) {
  const events = [];
  const repository = {
    listTargets: () => [
      {
        plantId: 'plant-1',
        plantName: 'Rose',
        managedFilename: 'old.png',
      },
    ],
    upsert: (record) => {
      events.push(['upsert', record]);
      if (failUpsert) throw new Error('database unavailable');
    },
    deleteByPlantId: () => null,
  };
  const storage = {
    stage: (filename) => events.push(['stage', filename]),
    commit: (filename) => events.push(['commit', filename]),
    discard: (filename) => events.push(['discard', filename]),
    remove: (filename) => events.push(['remove', filename]),
  };
  return {
    events,
    value: {
      repository,
      storage,
      runInTransaction: (operation) => operation(),
      validatePhotoFiles: (files) => ({
        images: files.map((file) => ({
          ...file,
          mediaType: 'image/png',
          extension: '.png',
        })),
        errors: [],
      }),
      now: () => '2026-08-15T12:00:00.000Z',
      createManagedFilename: () => 'new.png',
    },
  };
}

test('photo-import workflow stages, persists, and cleans previous files', () => {
  const { value, events } = dependencies();
  const result = importPlantPhotos(value, [
    { name: 'ROSE.png', bytes: new Uint8Array([1, 2, 3]) },
  ]);

  assert.deepEqual(result, { ok: true, imported: 1, unmatched: [] });
  assert.equal(events[0][0], 'stage');
  assert.equal(events[1][0], 'commit');
  assert.equal(events[2][0], 'upsert');
  assert.deepEqual(events.at(-1), ['remove', 'old.png']);
});

test('photo-import workflow discards staged files when persistence fails', () => {
  const { value, events } = dependencies({ failUpsert: true });
  const result = importPlantPhotos(value, [
    { name: 'Rose.png', bytes: new Uint8Array([1, 2, 3]) },
  ]);

  assert.equal(result.ok, false);
  assert.deepEqual(events.at(-1), ['discard', 'new.png']);
});
