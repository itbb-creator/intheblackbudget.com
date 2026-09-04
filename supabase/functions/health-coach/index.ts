import { handleOptions, jsonResponse, readJson } from '../_shared/cors.ts';
import { envGet } from '../_shared/config.ts';
import { getSupabase } from '../_shared/supabase.ts';

type HealthRequest = {
  mode?: 'analysis' | 'question' | 'scenario' | 'checkin';
  prompt?: string;
  financial?: {
    score?: number;
    income?: number;
    expenses?: number;
    investing?: number;
    debtPayments?: number;
    surplus?: number;
    emergencyMonths?: number;
  };
  scenario?: {
    expenseReduction?: number;
    investingIncrease?: number;
    debtPaymentIncrease?: number;
  };
  checkin?: { confidence?: string; priority?: string; surprise?: string };
};

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    actions: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
    question: { type: 'string' },
    caution: { type: 'string' },
  },
  required: ['headline', 'summary', 'actions', 'question', 'caution'],
};

function cleanNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-100_000_000, Math.min(100_000_000, number)) : 0;
}

function cleanRequest(body: HealthRequest): HealthRequest {
  const financial = body.financial ?? {};
  const scenario = body.scenario ?? {};
  return {
    mode: ['analysis', 'question', 'scenario', 'checkin'].includes(body.mode ?? '') ? body.mode : 'analysis',
    prompt: String(body.prompt ?? '').slice(0, 1200),
    financial: {
      score: cleanNumber(financial.score),
      income: cleanNumber(financial.income),
      expenses: cleanNumber(financial.expenses),
      investing: cleanNumber(financial.investing),
      debtPayments: cleanNumber(financial.debtPayments),
      surplus: cleanNumber(financial.surplus),
      emergencyMonths: cleanNumber(financial.emergencyMonths),
    },
    scenario: {
      expenseReduction: cleanNumber(scenario.expenseReduction),
      investingIncrease: cleanNumber(scenario.investingIncrease),
      debtPaymentIncrease: cleanNumber(scenario.debtPaymentIncrease),
    },
    checkin: {
      confidence: String(body.checkin?.confidence ?? '').slice(0, 80),
      priority: String(body.checkin?.priority ?? '').slice(0, 200),
      surprise: String(body.checkin?.surprise ?? '').slice(0, 300),
    },
  };
}

async function safetyIdentifier(userId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest)).slice(0, 16).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, req);
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const sb = getSupabase();
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user?.id) return jsonResponse({ error: 'Your session is no longer valid.' }, 401, req);
    const input = cleanRequest(await readJson<HealthRequest>(req));
    const apiKey = envGet('OPENAI_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'AI coaching is not configured yet.' }, 503, req);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: envGet('OPENAI_HEALTH_MODEL') || 'gpt-5.4-mini',
        store: false,
        safety_identifier: await safetyIdentifier(data.user.id),
        instructions: 'You are Pravely AI, an educational financial planning coach. Treat the supplied Pravely calculations as authoritative; never recalculate or invent account data. Be concise, supportive, specific, and practical. Do not recommend individual securities, diagnose legal or tax situations, promise outcomes, or present guidance as professional financial advice. Ask one useful follow-up question. Return only the requested JSON.',
        input: JSON.stringify(input),
        text: { format: { type: 'json_schema', name: 'health_coach_response', strict: true, schema } },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('health-coach OpenAI error:', result);
      return jsonResponse({ error: 'Personalized coaching is temporarily unavailable.' }, 502, req);
    }
    const outputText = result.output_text ?? result.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === 'output_text')?.text;
    if (!outputText) return jsonResponse({ error: 'The coach returned an empty response.' }, 502, req);
    return jsonResponse({ ...JSON.parse(outputText), source: 'ai' }, 200, req);
  } catch (error) {
    console.error('health-coach error:', error);
    return jsonResponse({ error: 'Personalized coaching is temporarily unavailable.' }, 500, req);
  }
});
