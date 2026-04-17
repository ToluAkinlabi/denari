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

  const cautionText = input.forecastWarnings.length > 0
    ? `${input.forecastWarnings.length} caution flag${input.forecastWarnings.length === 1 ? '' : 's'} are active.`
    : 'No immediate caution flags are active.';

  return `${paceLabel} If you add about $${input.scenarioExtraSpend} of unplanned spend, next-period ending cash may land near $${input.scenarioRiskCash}. Keeping savings and partnership commitments protects discipline, while skipping up to $${input.scenarioSkipSavings} savings and $${input.scenarioSkipPartnership} partnership would raise short-term liquidity to around $${input.scenarioLiquidityCash}. ${cautionText}`;
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
    'Sentence 1: trend view using recent 3-period averages vs current pace.',
    'Sentence 2: explicit if/then scenario using extra spend amount and its cash impact.',
    'Sentence 3: one concrete action for the next 24 hours that references savings/partnership discipline and ending-cash protection.',
    'Sentence 4: if warnings exist, mention the highest-risk warning in plain language and tie it to the action.',
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
