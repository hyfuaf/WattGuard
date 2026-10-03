const KIMI_ENDPOINT = 'https://api.moonshot.cn/v1/chat/completions';

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
  if (!response.ok) throw new Error(`Kimi request failed (${response.status})`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content)
    ? content.filter(part => part.type === 'text' && typeof part.text === 'string').map(part => part.text).join('\n')
    : '';
  if (!text.trim()) throw new Error('Kimi returned no text');
  return text.trim();
}
