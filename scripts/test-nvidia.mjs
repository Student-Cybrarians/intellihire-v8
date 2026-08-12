const endpoint = process.env.NVIDIA_API_BASE_URL || "https://integrate.api.nvidia.com/v1/chat/completions";
const apiKey = process.env.NVIDIA_API_KEY;
const model = process.env.NVIDIA_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

if (!apiKey) {
  console.error("Missing NVIDIA_API_KEY");
  process.exit(1);
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "Reply with exactly: IntelliHire NVIDIA test OK" }],
    max_tokens: 64,
    temperature: 0.2,
    stream: false,
  }),
});

const data = await response.json().catch(() => null);

if (!response.ok) {
  console.error(`NVIDIA API returned ${response.status}`);
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  model: data?.model || model,
  text: data?.choices?.[0]?.message?.content || null,
  usage: data?.usage || null,
}, null, 2));
