#!/usr/bin/env node
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error('❌ GROQ_API_KEY not set in environment');
  process.exit(1);
}

console.log('[TEST] Testing Groq API connection...\n');

fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'user',
        content: 'Say in one sentence what is playbook automation.',
      },
    ],
    temperature: 0.7,
    max_tokens: 100,
  }),
})
  .then((res) => {
    if (!res.ok) {
      return res.text().then(text => {
        throw new Error(`HTTP ${res.status}: ${text}`);
      });
    }
    return res.json();
  })
  .then((data) => {
    console.log('✅ Success!\n');
    console.log('[RESPONSE]');
    console.log(`Content: ${data.choices?.[0]?.message?.content || 'N/A'}\n`);
    console.log('[METRICS]');
    console.log(`Input tokens: ${data.usage?.prompt_tokens || 0}`);
    console.log(`Output tokens: ${data.usage?.completion_tokens || 0}`);
    console.log(`Provider: groq`);
    console.log(`\n🎉 Groq is ready to use!`);
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    console.error('\n[DEBUGGING]');
    console.error('1. Check if GROQ_API_KEY is set in .env');
    console.error('2. Check if API key is valid');
    console.error('3. Verify internet connectivity');
    process.exit(1);
  });
