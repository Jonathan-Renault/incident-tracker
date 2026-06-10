// tests/api.test.js
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, existsSync } from 'node:fs';
import supertest from 'supertest';

const TEST_DB = './test-incident.db';
process.env.DB_PATH = TEST_DB;

const { default: app } = await import('../server.js');
const request = supertest(app);

test('GET /api/status returns null when DB is empty', async () => {
  const res = await request.get('/api/status');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { last_incident: null });
});

after(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});
