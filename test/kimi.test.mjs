import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKimiText, kimiConfigured } from '../src/kimi.js';

const config = { KIMI_API_KEY: 'test-key', KIMI_MODEL: 'kimi-k2.5' };

test('Kimi adapter sends Chat Completions and returns assistant text', async () => {
  let called = false;
  const result = await generateKimiText(config, '只分析用电量', { energyKwh: 1.2 }, async (url, options) => {
    called = true;
    assert.equal(url, 'https://api.moonshot.cn/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'kimi-k2.5');
    assert.deepEqual(body.messages, [
      { role: 'system', content: '只分析用电量' },
      { role: 'user', content: '{"energyKwh":1.2}' }
    ]);
    return { ok: true, json: async () => ({ choices: [{ message: { content: '建议核对待机时段' } }] }) };
  });
  assert.equal(called, true);
  assert.equal(result, '建议核对待机时段');
});

test('Kimi adapter rejects unavailable or empty output', async () => {
  assert.equal(kimiConfigured({}), false);
  await assert.rejects(generateKimiText(config, '分析', {}, async () => ({ ok: false, status: 429 })), /429/);
  await assert.rejects(generateKimiText(config, '分析', {}, async () => ({ ok: true, json: async () => ({ choices: [] }) })), /no text/);
});
