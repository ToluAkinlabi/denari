import { unstable_cache } from 'next/cache';

export interface DailyInsightInput {
  income: string;
  spending: string;
  savings: string;
  wealthCreated: string;
  endingCash: string;
  spendingPercent: string;
  savingsRate: string;
  paceStatus: 'GREEN' | 'YELLOW' | 'RED';
  periodDay: number;
  totalDays: number;
  forecastIncome: string;
  forecastSpending: string;
  forecastSavings: string;
  forecastEndingCash: string;
  forecastWarnings: string[];
  avgRecentIncome: string;
  avgRecentSpending: string;
  avgRecentSavings: string;
  scenarioExtraSpend: string;
  scenarioSkipSavings: string;
  scenarioSkipPartnership: string;
  scenarioRiskCash: string;
  scenarioLiquidityCash: string;
  daysRemaining: number;
  suggestedDailySpendCap: string;
  priorityBucketName: string;
  priorityBucketRemaining: string;
  priorityBucketStatus: string;
  guidanceConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  guidanceConfidenceReason: string;
  weeklyTrendSummary: string;
  weeklyTrendBuckets: string;
  transferSuggestionSummary: string;
  rafProfileSource: string;
  rafTotalPercent: string;
  rafAllocated: string;
  rafUnallocated: string;
  rafOverallocated: string;
  rafTopBuckets: string;
  rafAtRiskBuckets: string;
  rafExhaustedBuckets: string;
  rafWarnings: string[];
}

export interface DailyInsightResult {
  summary: string;
  model: string;
  generatedAt: string;
}

function fallbackInsight(input: DailyInsightInput): string {
  const paceLabel =
    input.paceStatus === 'RED'
      ? 'Your pace is running hot right now.'
      : input.paceStatus === 'YELLOW'
      ? 'Your pace is close to plan.'
      : 'Your pace is under control.';

  const rafText = input.rafWarnings.length > 0
    ? ` RAF is ${input.rafProfileSource.toLowerCase()} and has ${input.rafWarnings.length} warning${input.rafWarnings.length === 1 ? '' : 's'}.`
    : ` RAF is ${input.rafProfileSource.toLowerCase()} with ${input.rafTotalPercent}% allocated across buckets.`;

  return `${paceLabel}${rafText} Guidance confidence is ${input.guidanceConfidence.toLowerCase()} (${input.guidanceConfidenceReason}). Protect ${input.priorityBucketName} first (${input.priorityBucketStatus.toLowerCase()} with $${input.priorityBucketRemaining} left), and keep discretionary spend near $${input.suggestedDailySpendCap}/day for the next ${input.daysRemaining} day(s). Weekly pressure signal: ${input.weeklyTrendSummary}; transfer idea: ${input.transferSuggestionSummary || 'none'}.`;
}

async function generateInsightWithClaude(input: DailyInsightInput): Promise<DailyInsightResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-latest';

  if (!apiKey) {
    return {
      summary: fallbackInsight(input),
      model: 'Claude',
      generatedAt: new Date().toISOString(),
    };
  }

  const prompt = [
    'You are a personal finance coach writing a concise, decision-oriented daily briefing.',
    'Write EXACTLY 4 sentences.',
    'Do not invent numbers. Use only the values provided below.',
    'Do not simply restate all totals; convert them into guidance and trade-offs.',
    'Always include at least 4 numeric values in the response.',
    'Use a single timeframe: this pay period plus the next-period projection. Do not mix unrelated horizons.',
    'Treat scenario amounts as bounded what-if adjustments, not recommendations to skip commitments.',
    'Keep tone practical, plain English, and action-first.',
    'Sentence 1: RAF status plus pace view. State total RAF percentage, allocated income, unallocated/overallocated cash, and current pace.',
    'Sentence 2: call out the weekly RAF pressure trend and the most pressured buckets by name.',
    'Sentence 3: one concrete next-24-hour action that protects the priority bucket and uses the provided spend-cap guidance.',
    'Sentence 4: mention guidance confidence, one transfer suggestion if available, and tie it to the action.',
    'Avoid phrases like "skip commitments" unless clearly marked as emergency-only and temporary.',
    '',
    `Current period: day ${input.periodDay} of ${input.totalDays}`,
    `Income: $${input.income}`,
    `Spending: $${input.spending}`,
    `Savings: $${input.savings}`,
    `Wealth created: $${input.wealthCreated}`,
    `Ending cash: $${input.endingCash}`,
    `Spending percentage of income: ${input.spendingPercent}`,
    `Savings rate: ${input.savingsRate}`,
    `Pace status: ${input.paceStatus}`,
    `Next period forecast income: ~$${input.forecastIncome}`,
    `Next period forecast spending: ~$${input.forecastSpending}`,
    `Next period forecast savings: ~$${input.forecastSavings}`,
    `Next period forecast ending cash: ~$${input.forecastEndingCash}`,
    `Average income across last 3 periods: ~$${input.avgRecentIncome}`,
    `Average spending across last 3 periods: ~$${input.avgRecentSpending}`,
    `Average savings across last 3 periods: ~$${input.avgRecentSavings}`,
    `RAF profile source: ${input.rafProfileSource}`,
    `RAF total percent: ${input.rafTotalPercent}%`,
    `RAF allocated from current income: $${input.rafAllocated}`,
    `RAF unallocated cash: $${input.rafUnallocated}`,
    `RAF overallocated amount: $${input.rafOverallocated}`,
    `Days remaining in period: ${input.daysRemaining}`,
    `Suggested daily discretionary spend cap: $${input.suggestedDailySpendCap}`,
    `Priority bucket to protect: ${input.priorityBucketName}`,
    `Priority bucket status: ${input.priorityBucketStatus}`,
    `Priority bucket remaining: $${input.priorityBucketRemaining}`,
    `Guidance confidence: ${input.guidanceConfidence}`,
    `Guidance confidence reason: ${input.guidanceConfidenceReason}`,
    `Weekly RAF trend summary: ${input.weeklyTrendSummary}`,
    `Weekly RAF trend buckets: ${input.weeklyTrendBuckets || 'none'}`,
    `Safe transfer suggestions: ${input.transferSuggestionSummary || 'none'}`,
    `RAF top buckets: ${input.rafTopBuckets || 'none'}`,
    `RAF at-risk buckets: ${input.rafAtRiskBuckets || 'none'}`,
    `RAF exhausted buckets: ${input.rafExhaustedBuckets || 'none'}`,
    `RAF warnings: ${input.rafWarnings.length > 0 ? input.rafWarnings.join(' | ') : 'none'}`,
    `Scenario extra spend today: +$${input.scenarioExtraSpend}`,
    `Scenario skip savings amount: $${input.scenarioSkipSavings}`,
    `Scenario skip partnership amount: $${input.scenarioSkipPartnership}`,
    `Scenario projected ending cash after extra spend: ~$${input.scenarioRiskCash}`,
    `Scenario projected ending cash if savings+partnership are skipped: ~$${input.scenarioLiquidityCash}`,
    `Warnings: ${input.forecastWarnings.length > 0 ? input.forecastWarnings.join(' | ') : 'none'}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 180,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      return {
        summary: fallbackInsight(input),
        model: 'Claude',
        generatedAt: new Date().toISOString(),
      };
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = data.content
      ?.filter((chunk) => chunk.type === 'text' && typeof chunk.text === 'string')
      .map((chunk) => chunk.text?.trim() ?? '')
      .join(' ')
      .trim();

    const safeText = text && text.length > 0 ? text : fallbackInsight(input);

    return {
      summary: safeText,
      model: model.toLowerCase().includes('claude') ? 'Claude' : 'AI',
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      summary: fallbackInsight(input),
      model: 'Claude',
      generatedAt: new Date().toISOString(),
    };
  }
}

export async function getDailyInsight(
  userId: string,
  input: DailyInsightInput
): Promise<DailyInsightResult> {
  const dayKey = new Date().toISOString().slice(0, 10);

  const cached = unstable_cache(
    async () => generateInsightWithClaude(input),
    [`daily-ai-insight:${userId}:${dayKey}`],
    {
      revalidate: 60 * 60 * 24,
      tags: [`daily-ai-insight:${userId}`],
    }
  );

  return cached();
}
