export function providerConfig(env = process.env) {
  const provider = env.AI_PROVIDER || (env.OPENROUTER_API_KEY ? 'openrouter' : 'openai');
  if (!['openai', 'openrouter'].includes(provider)) throw new Error('Unsupported AI_PROVIDER');
  return {
    provider,
    key: provider === 'openrouter' ? env.OPENROUTER_API_KEY : env.OPENAI_API_KEY,
    model: env.AI_MODEL || (provider === 'openrouter' ? 'z-ai/glm-5.3-flash' : 'gpt-5.6-luna'),
    url: provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/responses',
  };
}

export async function requestRepair(prompt, config, fetchImpl = fetch) {
  if (!config.key) throw new Error(`Missing ${config.provider} API key`);
  const body = config.provider === 'openrouter'
    ? { model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens: 12000, temperature: 0.2 }
    : { model: config.model, input: prompt, max_output_tokens: 12000, reasoning: { effort: 'medium' }, store: false };
  const response = await fetchImpl(config.url, {
    method: 'POST', signal: AbortSignal.timeout(180000),
    headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // Provider error bodies may contain echoed requests. Never put them in CI logs.
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
  const payload = await response.json();
  const text = config.provider === 'openrouter'
    ? payload.choices?.[0]?.message?.content
    : payload.output?.flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('\n');
  if (typeof text !== 'string' || !text.trim()) throw new Error('AI provider returned no repair text');
  console.log(`Repair model: ${config.model}; tokens used: ${payload.usage?.total_tokens ?? 'unreported'}`);
  return text;
}
