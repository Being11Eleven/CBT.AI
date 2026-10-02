/* ============================================================
   CBT.AI Backend — Unified Multi-Provider Engine
   Integrates FreeLLMAPI gateway + Direct Free Tier Adapters:
   - Gemini Free Tier (native API)
   - Groq Cloud Free Tier (OpenAI compatible)
   - OpenRouter Free Models (:free suffix)
   - Cerebras Free Tier (OpenAI compatible)
   - FreeLLMAPI Gateway (/v1/chat/completions)
   Captures rate-limit headers to feed the Quota Engine.
   Zero secrets exposed to client. Strict FREE_ONLY enforcement.
   ============================================================ */

import { logger } from '../logging/logger.js';
import { ModelEndpointSpec } from './catalog.js';
import { quotaEngine } from './quota-engine.js';
import { smartRouter, TaskRequirements, RouteExecutionResult } from './router.js';

export interface GenerateAIOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  requireMath?: boolean;
  requireReasoning?: boolean;
  preferredProvider?: string;
  globalDeadlineMs?: number;
}

// ── Low-level HTTP dispatch for each provider protocol ───────────

async function callProviderEndpoint(
  spec: ModelEndpointSpec,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<{ content: string; tokensUsed?: number; headers?: Record<string, string | string[] | undefined> }> {
  const provider = spec.provider;

  // 1. Gemini Native Free Tier API
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured on server');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${spec.model}:generateContent?key=${apiKey}`;
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: spec.capabilities.maxOutputTokens || 8192,
        responseMimeType: 'application/json',
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => { resHeaders[key] = val; });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API error HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { totalTokenCount?: number };
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      content: text,
      tokensUsed: data.usageMetadata?.totalTokenCount,
      headers: resHeaders,
    };
  }

  // 2. Groq Cloud Free Tier (OpenAI compatible)
  if (provider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY not configured on server');
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: spec.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: spec.capabilities.maxOutputTokens || 8192,
        response_format: { type: 'json_object' },
      }),
      signal,
    });

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => { resHeaders[key] = val; });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Groq API error HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };

    return {
      content: data.choices?.[0]?.message?.content || '',
      tokensUsed: data.usage?.total_tokens,
      headers: resHeaders,
    };
  }

  // 3. OpenRouter Free Tier (:free models)
  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured on server');
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://cbt-ai.app',
        'X-Title': 'CBT.AI Universal Examination Engine',
      },
      body: JSON.stringify({
        model: spec.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: spec.capabilities.maxOutputTokens || 4096,
        response_format: { type: 'json_object' },
      }),
      signal,
    });

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => { resHeaders[key] = val; });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenRouter API error HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };

    return {
      content: data.choices?.[0]?.message?.content || '',
      tokensUsed: data.usage?.total_tokens,
      headers: resHeaders,
    };
  }

  // 4. Cerebras Free Tier
  if (provider === 'cerebras') {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) {
      throw new Error('CEREBRAS_API_KEY not configured on server');
    }

    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: spec.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: spec.capabilities.maxOutputTokens || 4096,
        response_format: { type: 'json_object' },
      }),
      signal,
    });

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => { resHeaders[key] = val; });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Cerebras API error HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };

    return {
      content: data.choices?.[0]?.message?.content || '',
      tokensUsed: data.usage?.total_tokens,
      headers: resHeaders,
    };
  }

  // 5. FreeLLMAPI Unified Gateway
  if (provider === 'freellmapi') {
    const baseUrl = process.env.FREELLMAPI_BASE_URL || 'http://localhost:8000';
    const apiKey = process.env.FREELLMAPI_API_KEY || 'sk-freellmapi-internal';

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: spec.model === 'auto-free' ? 'auto' : spec.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: spec.capabilities.maxOutputTokens || 4096,
        response_format: { type: 'json_object' },
      }),
      signal,
    });

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => { resHeaders[key] = val; });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`FreeLLMAPI error HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };

    return {
      content: data.choices?.[0]?.message?.content || '',
      tokensUsed: data.usage?.total_tokens,
      headers: resHeaders,
    };
  }

  throw new Error(`Unsupported provider protocol: ${provider}`);
}

// ── High-level generation entry point ─────────────────────────────

export async function generateExamAI(
  prompt: string,
  systemPrompt: string,
  options?: GenerateAIOptions
): Promise<RouteExecutionResult> {
  // Estimate token requirements
  const estimatedInputTokens = Math.ceil((prompt.length + systemPrompt.length) / 4);
  const expectedOutputTokens = options?.maxTokens || 4096;

  const task: TaskRequirements = {
    estimatedInputTokens,
    expectedOutputTokens,
    requireJson: options?.responseFormat === 'json',
    requireMath: options?.requireMath,
    requireReasoning: options?.requireReasoning,
    temperature: options?.temperature,
    preferredProvider: options?.preferredProvider,
    globalDeadlineMs: options?.globalDeadlineMs,
  };

  return smartRouter.executeWithFailover(
    systemPrompt,
    prompt,
    task,
    callProviderEndpoint
  );
}

// ── Public AI Status for Student UI ─────────────────────────────

export interface PublicAIStatus {
  status: 'ready' | 'degraded' | 'unavailable';
  headline: string;
  subtext: string;
}

export function getPublicAIStatus(): PublicAIStatus {
  const states = quotaEngine.getAllStates();
  const availableCount = states.filter(s => s.isAvailable && (!s.cooldownUntil || Date.now() >= s.cooldownUntil)).length;

  if (availableCount >= 2) {
    return {
      status: 'ready',
      headline: 'AI Service: Ready',
      subtext: 'Examination engine ready for real-time generation.',
    };
  } else if (availableCount === 1) {
    return {
      status: 'degraded',
      headline: 'AI Service: Ready',
      subtext: 'Operating with normal capacity under active traffic.',
    };
  } else {
    return {
      status: 'unavailable',
      headline: 'AI Service: Temporarily Unavailable',
      subtext: 'AI generation is temporarily unavailable. Please try again shortly.',
    };
  }
}
