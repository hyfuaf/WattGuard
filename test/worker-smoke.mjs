import assert from 'node:assert/strict';

const base = process.env.WATTGUARD_URL || 'http://127.0.0.1:8791';
async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

const stamp = Date.now();
const owner = await request('/api/register', { method: 'POST', body: { email: `worker-${stamp}@example.com`, password: 'Testing123!', name: '测试家庭' } });
assert.equal(owner.status, 200, JSON.stringify(owner.data));
const other = await request('/api/register', { method: 'POST', body: { email: `other-${stamp}@example.com`, password: 'Testing123!', name: '另一家庭' } });
assert.equal(other.status, 200);
const deviceId = `SP-${stamp}`;
const bound = await request('/api/devices', { method: 'POST', cookie: owner.cookie, body: { deviceId, alias: '工作电脑', type: '电脑', room: '书房', spec: '台式机' } });
assert.equal(bound.status, 200, JSON.stringify(bound.data));
const { bindingId } = bound.data;
assert.equal(bound.data.token, undefined);
assert.equal((await request(`/api/devices/${bindingId}`, { cookie: other.cookie })).status, 404);

const start = Date.now();
const telemetry = timestamp => ({ deviceId, timestamp, powerWatts: 100 });
assert.equal((await request('/api/telemetry', { method: 'POST', body: telemetry(start) })).status, 200);
await new Promise(resolve => setTimeout(resolve, 1100));
assert.equal((await request('/api/telemetry', { method: 'POST', body: telemetry(start + 1000) })).status, 200);
assert.equal((await request('/api/telemetry', { method: 'POST', body: { ...telemetry(start + 2000), deviceId: 'unknown-plug' } })).status, 404);
const snapshot = await request('/api/dashboard', { cookie: owner.cookie });
assert.equal(snapshot.status, 200);
assert.ok(snapshot.data.energy > 0, 'measured interval should produce energy');
const report = await request('/api/reports', { method: 'POST', cookie: owner.cookie, body: { days: 7, ai: false } });
assert.equal(report.status, 200, JSON.stringify(report.data));
assert.equal((await request(`/api/reports/${report.data.id}`, { cookie: owner.cookie })).data.kind, 'statistics');
assert.equal((await request(`/api/reports/${report.data.id}`, { cookie: other.cookie })).status, 404);
assert.equal((await request(`/api/devices/${bindingId}/export`, { cookie: owner.cookie })).status, 200);
assert.equal((await request(`/api/devices/${bindingId}/token`, { method: 'POST', cookie: owner.cookie })).status, 404);
assert.equal((await request(`/api/devices/${bindingId}`, { method: 'DELETE', cookie: owner.cookie })).status, 200);
assert.equal((await request('/api/telemetry', { method: 'POST', body: telemetry(Date.now()) })).status, 404);
assert.equal((await request(`/api/devices/${bindingId}/permanent`, { method: 'DELETE', cookie: other.cookie })).status, 404);
const rebound = await request('/api/devices', { method: 'POST', cookie: owner.cookie, body: { deviceId, alias: '新电脑', type: '电脑', room: '书房' } });
assert.equal(rebound.status, 200);
assert.equal((await request(`/api/devices/${bindingId}/permanent`, { method: 'DELETE', cookie: owner.cookie })).status, 200);
assert.equal((await request(`/api/devices/${rebound.data.bindingId}`, { cookie: owner.cookie })).status, 200);
assert.equal((await request(`/api/reports/${report.data.id}`, { cookie: owner.cookie })).data.body.snapshot.devices[0].alias, '工作电脑');
assert.equal((await request(`/api/devices/${rebound.data.bindingId}/permanent`, { method: 'DELETE', cookie: owner.cookie })).status, 200);
assert.equal((await request('/api/devices', { method: 'POST', cookie: owner.cookie, body: { deviceId, alias: '再次绑定', type: '电脑', room: '书房' } })).status, 200);
console.log('Worker smoke test passed');
