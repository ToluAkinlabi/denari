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
      ? 'Running hot'
      : input.paceStatus === 'YELLOW'
      ? 'Near pace'
      : 'Under control';

  const rafStatus = input.rafWarnings.length > 0
    ? `${input.rafWarnings.length} pressure point${input.rafWarnings.length === 1 ? '' : 's'}`
    : `${input.rafTotalPercent}% allocated`;

  return `**Key Insights:**\n${paceLabel}—spending is ${input.paceStatus === 'RED' ? 'running above' : input.paceStatus === 'YELLOW' ? 'near' : 'below'} pace. RAF is ${input.rafProfileSource.toLowerCase()} with ${rafStatus}. Next period projects ~$${input.forecastEndingCash} cash.\n\n**Recommended Actions:**\n• Aim for $${input.suggestedDailySpendCap}/day discretionary spend over the next ${input.daysRemaining} day(s)\n• Protect ${input.priorityBucketName} first (${input.priorityBucketStatus.toLowerCase()})\n${input.transferSuggestionSummary ? `• Consider: ${input.transferSuggestionSummary}` : ''}\n• Monitor weekly pressure: ${input.weeklyTrendSummary}`;
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
    'You are a personal finance coach writing concise, actionable daily briefings.',
    '',
    'STRUCTURE YOUR RESPONSE EXACTLY AS:',
    '**Key Insights:**',
    '[2-3 sentences of solid financial insights]',
    '',
    '**Recommended Actions:**',
    '[4-6 bulleted items with specific, actionable guidance]',
    '',
    'KEY PRINCIPLES:',
    '• Do not invent numbers. Use ONLY the values provided below.',
    '• Make each insight concrete and connected to today\'s financial position.',
    '• Convert totals into meaningful trade-offs and risks.',
    '• Always lead with the most important pattern or risk.',
    '• Use plain, direct language focused on decisions.',
    '• Each action should be a complete sentence starting with a verb.',
    '',
    'INSIGHTS GUIDANCE:',
    'Focus on: (1) pace status vs. RAF allocation match, (2) top pressure bucket + recommended response, (3) next-period risk if trends continue.',
    'Mention specific numbers: income, pace, cash remaining, forecast cash.',
    '',
    'ACTIONS GUIDANCE:',
    '• Include a concrete daily spend cap based on days remaining.',
    '• Name the priority bucket to protect.',
    '• Mention the top pressure or opportunity.',
    '• Suggest a transfer if one is available.',
    '• Flag any high-risk scenarios.',
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
    `RAF overallocated amount: ${input.rafOverallocated}`,
    `Days remaining in period: ${input.daysRemaining}`,
    `Suggested daily discretionary spend cap: $${input.suggestedDailySpendCap}`,
    `Priority bucket to protect: ${input.priorityBucketName}`,
    `Priority bucket status: ${input.priorityBucketStatus}`,
    `Priority bucket remaining: $${input.priorityBucketRemaining}`,
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
        max_tokens: 280,
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
