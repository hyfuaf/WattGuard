const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';

export class OpenAiApiError extends Error {
  constructor(status) {
    super(`OpenAI request failed (${status})`);
    this.status = status;
  }
}

export function openAiErrorMessage(error) {
  if (!(error instanceof OpenAiApiError)) return 'OpenAI 服务暂时不可用，请稍后重试';
  if (error.status === 401) return 'OpenAI API Key 无效，请检查服务端密钥';
  if (error.status === 402) return 'OpenAI API 账户余额不足，请检查账户额度';
  if (error.status === 403) return 'OpenAI API 账户没有访问该模型的权限';
  if (error.status === 404) return 'OpenAI 模型不可用，请检查模型名称和账户权限';
  if (error.status === 429) return 'OpenAI 请求已达到限额，请稍后重试';
  if (error.status === 400 || error.status === 422) return 'OpenAI 拒绝了请求，请检查模型名称和参数';
  return 'OpenAI 服务暂时不可用，请稍后重试';
}

export function openAiConfigured(config) {
  return Boolean(config.OPENAI_API_KEY && config.OPENAI_MODEL);
}

export async function generateOpenAiText(config, instructions, input, fetchImpl = fetch) {
  if (!openAiConfigured(config)) throw new Error('OpenAI API is not configured');
  const response = await fetchImpl(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.OPENAI_MODEL,
      instructions,
      input: JSON.stringify(input),
      max_output_tokens: 3000
    }),
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new OpenAiApiError(response.status);
  const data = await response.json();
  const text = data.output?.flatMap(item => item.type === 'message' ? item.content || [] : [])
    .filter(part => part.type === 'output_text' && typeof part.text === 'string')
    .map(part => part.text).join('\n').trim();
  if (!text) throw new Error('OpenAI returned no text');
  return text;
}
