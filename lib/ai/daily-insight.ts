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
}

export interface DailyInsightResult {
  summary: string;
  model: string;
  generatedAt: string;
}

function fallbackInsight(input: DailyInsightInput): string {
  const paceLabel =
    input.paceStatus === 'RED'
      ? 'Spending pace is above target right now.'
      : input.paceStatus === 'YELLOW'
      ? 'Spending pace is close to target.'
      : 'Spending pace is under target.';

  const warningText = input.forecastWarnings.length > 0
    ? `Forecast shows ${input.forecastWarnings.length} caution flag${input.forecastWarnings.length === 1 ? '' : 's'}.`
    : 'Forecast currently shows no major caution flags.';

  return `Income is $${input.income}, spending is $${input.spending}, and savings is $${input.savings} for this period. ${paceLabel} ${warningText}`;
}

async function generateInsightWithClaude(input: DailyInsightInput): Promise<DailyInsightResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-latest';

  if (!apiKey) {
    return {
      summary: fallbackInsight(input),
      model: 'fallback-no-key',
      generatedAt: new Date().toISOString(),
    };
  }

  const prompt = [
    'You are a personal finance assistant writing a concise daily briefing.',
    'Write ONLY 3-4 sentences, practical and clear, with a mixed tone: professional + supportive coach.',
    'Do not invent numbers. Use only the values provided below.',
    'Always include at least two numeric values in the response.',
    'If there are warnings, mention the main risk briefly.',
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
        model: `fallback-http-${response.status}`,
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
      model,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      summary: fallbackInsight(input),
      model: 'fallback-error',
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
