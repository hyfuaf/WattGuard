import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateQwenText, qwenConfigured, qwenErrorMessage } from '../src/qwen.js';

const config = { QWEN_API_KEY: 'test-key', QWEN_MODEL: 'qwen-plus' };

test('Qwen adapter sends chat completion and returns model text', async () => {
  const result = await generateQwenText(config, '只分析用电量', { energyKwh: 1.2 }, async (url, options) => {
    assert.equal(url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'qwen-plus');
    assert.deepEqual(body.messages, [
      { role: 'system', content: '只分析用电量' },
      { role: 'user', content: '{"energyKwh":1.2}' }
    ]);
    return { ok: true, json: async () => ({ choices: [{ message: { content: '建议核对待机时段' } }] }) };
  });
  assert.equal(result, '建议核对待机时段');
});

test('Qwen adapter rejects unavailable or empty output', async () => {
  assert.equal(qwenConfigured({}), false);
  await assert.rejects(generateQwenText(config, '分析', {}, async () => ({ ok: false, status: 429 })), /429/);
  await assert.rejects(generateQwenText(config, '分析', {}, async () => ({ ok: true, json: async () => ({ choices: [] }) })), /no text/);
});

test('Qwen errors show actionable status without upstream response details', async () => {
  for (const [status, expected] of [[401, 'API Key 无效'], [402, '余额不足'], [403, '没有访问'], [404, '模型不可用'], [429, '达到限额'], [400, '检查模型名称']]) {
    await assert.rejects(generateQwenText(config, '分析', {}, async () => ({ ok: false, status })), error => {
      assert.match(qwenErrorMessage(error), new RegExp(expected));
      return true;
    });
  }
  assert.match(qwenErrorMessage(new Error('network detail')), /暂时不可用/);
});
