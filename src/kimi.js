const KIMI_ENDPOINT = 'https://api.moonshot.cn/v1/chat/completions';

export class KimiApiError extends Error {
  constructor(status) {
    super(`Kimi request failed (${status})`);
    this.status = status;
  }
}

export function kimiErrorMessage(error) {
  if (!(error instanceof KimiApiError)) return 'Kimi AI 服务暂时不可用，请稍后重试';
  if (error.status === 401) return 'Kimi API Key 无效，请检查服务端密钥';
  if (error.status === 402) return 'Kimi 账户余额不足，请检查账户额度';
  if (error.status === 403) return 'Kimi API Key 没有访问该模型的权限';
  if (error.status === 404) return 'Kimi 模型不可用，请检查模型名称';
  if (error.status === 429) return 'Kimi 请求已达到限额，请稍后重试';
  if (error.status === 400 || error.status === 422) return 'Kimi 拒绝了报告请求，请检查模型配置';
  return 'Kimi AI 服务暂时不可用，请稍后重试';
}

export function kimiConfigured(config) {
  return Boolean(config.KIMI_API_KEY && config.KIMI_MODEL);
}

export async function generateKimiText(config, instructions, input, fetchImpl = fetch) {
  if (!kimiConfigured(config)) throw new Error('Kimi API is not configured');
  const response = await fetchImpl(KIMI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.KIMI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.KIMI_MODEL,
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: JSON.stringify(input) }
      ],
      max_tokens: 1800
    }),
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new KimiApiError(response.status);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content)
    ? content.filter(part => part.type === 'text' && typeof part.text === 'string').map(part => part.text).join('\n')
    : '';
  if (!text.trim()) throw new Error('Kimi returned no text');
  return text.trim();
}
