import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOpenAiText, openAiConfigured, openAiErrorMessage } from '../src/openai.js';

const config = { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'gpt-5.6' };

test('OpenAI adapter sends Responses request and returns model text', async () => {
  const result = await generateOpenAiText(config, '只分析用电量', { energyKwh: 1.2 }, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gpt-5.6');
    assert.equal(body.instructions, '只分析用电量');
    assert.equal(body.input, '{"energyKwh":1.2}');
    return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: '建议核对待机时段' }] }] }) };
  });
  assert.equal(result, '建议核对待机时段');
});

test('OpenAI adapter rejects unavailable or empty output', async () => {
  assert.equal(openAiConfigured({}), false);
  await assert.rejects(generateOpenAiText(config, '分析', {}, async () => ({ ok: false, status: 429 })), /429/);
  await assert.rejects(generateOpenAiText(config, '分析', {}, async () => ({ ok: true, json: async () => ({ output: [] }) })), /no text/);
});

test('OpenAI errors show actionable status without upstream response details', async () => {
  for (const [status, expected] of [[401, 'API Key 无效'], [402, '余额不足'], [403, '没有访问'], [404, '模型不可用'], [429, '达到限额'], [400, '检查模型名称']]) {
    await assert.rejects(generateOpenAiText(config, '分析', {}, async () => ({ ok: false, status })), error => {
      assert.match(openAiErrorMessage(error), new RegExp(expected));
      return true;
    });
  }
  assert.match(openAiErrorMessage(new Error('network detail')), /暂时不可用/);
});
