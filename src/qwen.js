const QWEN_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

export class QwenApiError extends Error {
  constructor(status) {
    super(`Qwen request failed (${status})`);
    this.status = status;
  }
}

export function qwenErrorMessage(error) {
  if (!(error instanceof QwenApiError)) return '千问服务暂时不可用，请稍后重试';
  if (error.status === 401) return '千问 API Key 无效，请检查服务端密钥';
  if (error.status === 402) return '千问 API 账户余额不足，请检查账户额度';
  if (error.status === 403) return '千问 API 账户没有访问该模型的权限';
  if (error.status === 404) return '千问模型不可用，请检查模型名称和账户权限';
  if (error.status === 429) return '千问请求已达到限额，请稍后重试';
  if (error.status === 400 || error.status === 422) return '千问拒绝了请求，请检查模型名称和参数';
  return '千问服务暂时不可用，请稍后重试';
}

export function qwenConfigured(config) {
  return Boolean(config.QWEN_API_KEY && config.QWEN_MODEL);
}

export async function generateQwenText(config, instructions, input, fetchImpl = fetch) {
  if (!qwenConfigured(config)) throw new Error('Qwen API is not configured');
  const response = await fetchImpl(QWEN_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.QWEN_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.QWEN_MODEL,
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: JSON.stringify(input) }
      ],
      max_tokens: 3000
    }),
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new QwenApiError(response.status);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Qwen returned no text');
  return text;
}
