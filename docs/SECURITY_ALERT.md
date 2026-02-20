# ⚠️⚠️⚠️  IMPORTANT: API KEY SECURITY ISSUE ⚠️⚠️⚠️

Your Groq API key has been exposed in this conversation:
```
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
```

**You should immediately:**

1. **Go to https://console.groq.com**
2. **Revoke this API key** (it's compromised)
3. **Create a new API key** with the same settings
4. **Update your `.env` file** with the new key

This is a security best practice. Anyone with this key can use your Groq account and incur charges (if your quota is exceeded or your account is changed to a paid tier).

---

## Issue Found

The models available on Groq are changing. The models in your key seem to be from an older version. 

**Available Groq Models** (as of Feb 2025):
- `llama-3.3-70b-versatile` ✅ (Currently recommended)
- `llama-3.2-90b-vision-preview`
- Some models from older versions are decommissioned

**Next Steps:**

1. **Revoke your current API key** (see warning above)
2. **Create a fresh API key** from the Groq console
3. Update files:
   - `apps/api/src/services/llm-adapter.ts` → use `llama-3.3-70b-versatile`
   - `.env` → add your new `GROQ_API_KEY`

