/* ============================================================
   CBT.AI Backend — AI Model & Provider Catalog
   Represents upstream FreeLLMAPI architecture:
   - 34 providers
   - 474 model families
   - 635 free provider/model endpoints
   (635 represents free model endpoints, NOT personal API keys)
   Strict FREE_ONLY filtering support.
   ============================================================ */

export interface ModelCapability {
  supportsJson: boolean;
  supportsMath: boolean;
  supportsReasoning: boolean;
  supportsVision: boolean;
  contextWindow: number;
  maxOutputTokens: number;
}

export type ResetType = 'per_minute' | 'daily_fixed' | 'rolling' | 'unknown';

export interface ModelEndpointSpec {
  endpointId: string;       // Unique endpoint identifier: "provider:model"
  provider: string;         // e.g., 'groq', 'gemini', 'openrouter', 'cerebras', 'mistral', 'deepinfra', 'github', 'cloudflare'
  providerDisplayName: string;
  model: string;            // Exact model string for the API call
  family: string;           // Model family (e.g. 'llama-3.3', 'gemini-2.0', 'mistral-7b', 'deepseek-r1')
  isFree: boolean;          // Strict FREE_ONLY flag
  capabilities: ModelCapability;
  defaultRpm?: number;      // Published requests per minute limit
  defaultRpd?: number;      // Published requests per day limit
  defaultTpm?: number;      // Published tokens per minute limit
  defaultTpd?: number;      // Published tokens per day limit
  resetType: ResetType;     // Schedule of quota reset
  priorityScore: number;    // Base priority (higher = preferred when quotas equal)
}

/**
 * Curated registry of primary free provider/model endpoints across FreeLLMAPI ecosystem.
 * Dynamically expandable via FreeLLMAPI /v1/models gateway.
 */
export const FREE_PROVIDER_ENDPOINTS: ModelEndpointSpec[] = [
  // ── Gemini Free Tier ──────────────────────────────────────────
  {
    endpointId: 'gemini:gemini-2.0-flash',
    provider: 'gemini',
    providerDisplayName: 'Google Gemini',
    model: 'gemini-2.0-flash',
    family: 'gemini-2.0',
    isFree: true,
    capabilities: {
      supportsJson: true,
      supportsMath: true,
      supportsReasoning: true,
      supportsVision: true,
      contextWindow: 1048576,
      maxOutputTokens: 8192,
    },
    defaultRpm: 15,
    defaultRpd: 1500,
    defaultTpm: 1000000,
    resetType: 'daily_fixed',
    priorityScore: 95,
  },
  {
    endpointId: 'gemini:gemini-1.5-flash',
    provider: 'gemini',
    providerDisplayName: 'Google Gemini',
    model: 'gemini-1.5-flash',
    family: 'gemini-1.5',
    isFree: true,
    capabilities: {
      supportsJson: true,
      supportsMath: true,
      supportsReasoning: true,
      supportsVision: true,
      contextWindow: 1048576,
      maxOutputTokens: 8192,
    },
    defaultRpm: 15,
    defaultRpd: 1500,
    defaultTpm: 1000000,
    resetType: 'daily_fixed',
    priorityScore: 90,
  },

  // ── Groq Free Tier (Ultra-Fast) ──────────────────────────────
  {
    endpointId: 'groq:llama-3.3-70b-versatile',
    provider: 'groq',
    providerDisplayName: 'Groq Cloud',
    model: 'llama-3.3-70b-versatile',
    family: 'llama-3.3',
    isFree: true,
    capabilities: {
      supportsJson: true,
      supportsMath: true,
      supportsReasoning: true,
      supportsVision: false,
      contextWindow: 131072,
      maxOutputTokens: 8192,
    },
    defaultRpm: 30,
    defaultRpd: 14400,
    defaultTpm: 30000,
    resetType: 'per_minute',
    priorityScore: 92,
  },
  {
    endpointId: 'groq:llama-3.1-8b-instant',
    provider: 'groq',
    providerDisplayName: 'Groq Cloud',
    model: 'llama-3.1-8b-instant',
    family: 'llama-3.1',
    isFree: true,
    capabilities: {
      supportsJson: true,
      supportsMath: true,
      supportsReasoning: false,
      supportsVision: false,
      contextWindow: 131072,
      maxOutputTokens: 8192,
    },
    defaultRpm: 30,
    defaultRpd: 14400,
    defaultTpm: 30000,
    resetType: 'per_minute',
    priorityScore: 85,
  },

  // ── OpenRouter Free Endpoints (:free suffix) ──────────────────
  {
    endpointId: 'openrouter:meta-llama/llama-3.3-70b-instruct:free',
    provider: 'openrouter',
    providerDisplayName: 'OpenRouter Free',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    family: 'llama-3.3',
    isFree: true,
    capabilities: {
      supportsJson: true,
      supportsMath: true,
      supportsReasoning: true,
      supportsVision: false,
      contextWindow: 65536,
      maxOutputTokens: 8192,
    },
    defaultRpm: 20,
    defaultRpd: 200,
    resetType: 'daily_fixed',
    priorityScore: 88,
  },
  {
    endpointId: 'openrouter:mistralai/mistral-7b-instruct:free',
    provider: 'openrouter',
    providerDisplayName: 'OpenRouter Free',
    model: 'mistralai/mistral-7b-instruct:free',
    family: 'mistral-7b',
    isFree: true,
    capabilities: {
      supportsJson: true,
      supportsMath: false,
      supportsReasoning: false,
      supportsVision: false,
      contextWindow: 32768,
      maxOutputTokens: 4096,
    },
    defaultRpm: 20,
    defaultRpd: 200,
    resetType: 'daily_fixed',
    priorityScore: 78,
  },
  {
    endpointId: 'openrouter:deepseek/deepseek-r1:free',
    provider: 'openrouter',
    providerDisplayName: 'OpenRouter Free',
    model: 'deepseek/deepseek-r1:free',
    family: 'deepseek-r1',
    isFree: true,
    capabilities: {
      supportsJson: true,
      supportsMath: true,
      supportsReasoning: true,
      supportsVision: false,
      contextWindow: 65536,
      maxOutputTokens: 8192,
    },
    defaultRpm: 10,
    defaultRpd: 100,
    resetType: 'daily_fixed',
    priorityScore: 89,
  },

  // ── Cerebras Free Tier ─────────────────────────────────────────
  {
    endpointId: 'cerebras:llama3.1-70b',
    provider: 'cerebras',
    providerDisplayName: 'Cerebras Inference',
    model: 'llama3.1-70b',
    family: 'llama-3.1',
    isFree: true,
    capabilities: {
      supportsJson: true,
      supportsMath: true,
      supportsReasoning: true,
      supportsVision: false,
      contextWindow: 8192,
      maxOutputTokens: 4096,
    },
    defaultRpm: 30,
    defaultRpd: 14400,
    defaultTpm: 60000,
    resetType: 'per_minute',
    priorityScore: 86,
  },

  // ── FreeLLMAPI Unified Gateway Endpoint ───────────────────────
  {
    endpointId: 'freellmapi:auto',
    provider: 'freellmapi',
    providerDisplayName: 'FreeLLMAPI Gateway',
    model: 'auto-free',
    family: 'gateway',
    isFree: true,
    capabilities: {
      supportsJson: true,
      supportsMath: true,
      supportsReasoning: true,
      supportsVision: false,
      contextWindow: 32768,
      maxOutputTokens: 4096,
    },
    defaultRpm: 60,
    resetType: 'rolling',
    priorityScore: 94,
  },
];

/**
 * Statistics reflecting FreeLLMAPI ecosystem reality:
 * 34 providers, 474 model families, 635 free endpoints.
 */
export const ECOSYSTEM_METRICS = {
  totalProviders: 34,
  totalModelFamilies: 474,
  totalFreeEndpoints: 635,
  note: '635 represents free model endpoints in the upstream registry. Available personal capacity depends on configured credentials and live provider limits.',
};
