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

test('POST /api/incident records current timestamp', async () => {
  const before = new Date().toISOString();
  const res = await request.post('/api/incident');
  const after_ts = new Date().toISOString();

  assert.equal(res.status, 200);
  assert.ok(res.body.last_incident >= before, 'timestamp should be >= before');
  assert.ok(res.body.last_incident <= after_ts, 'timestamp should be <= after');
});

test('GET /api/status returns timestamp after incident recorded', async () => {
  const postRes = await request.post('/api/incident');
  const getRes = await request.get('/api/status');

  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.last_incident, postRes.body.last_incident);
});

test('POST /api/incident overwrites previous timestamp', async () => {
  await request.post('/api/incident');
  await new Promise(r => setTimeout(r, 20));
  const second = await request.post('/api/incident');
  const status = await request.get('/api/status');

  assert.equal(status.body.last_incident, second.body.last_incident);
});

after(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});
