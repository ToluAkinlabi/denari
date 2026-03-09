import { PrismaClient, ForecastStrategy } from '@prisma/client';

const prisma = new PrismaClient();

type TuningRule = {
  strategy: ForecastStrategy;
  expectedFrequency: string;
  isDiscretionary: boolean;
};

const RULES: Record<string, TuningRule> = {
  income: { strategy: 'KNOWN_RECURRING', expectedFrequency: 'BIWEEKLY', isDiscretionary: false },
  grocery: { strategy: 'KNOWN_VARIABLE', expectedFrequency: 'BIWEEKLY', isDiscretionary: false },
  rent: { strategy: 'KNOWN_IRREGULAR', expectedFrequency: 'MONTHLY', isDiscretionary: false },
  phone: { strategy: 'KNOWN_IRREGULAR', expectedFrequency: 'MONTHLY', isDiscretionary: false },
  debt: { strategy: 'KNOWN_VARIABLE', expectedFrequency: 'BIWEEKLY', isDiscretionary: false },
  other: { strategy: 'UNKNOWN', expectedFrequency: 'VARIABLE', isDiscretionary: false },
  spend: { strategy: 'KNOWN_VARIABLE', expectedFrequency: 'BIWEEKLY', isDiscretionary: true },
  misc: { strategy: 'UNKNOWN', expectedFrequency: 'VARIABLE', isDiscretionary: true },
  partnership: { strategy: 'KNOWN_VARIABLE', expectedFrequency: 'BIWEEKLY', isDiscretionary: false },
  savings: { strategy: 'KNOWN_VARIABLE', expectedFrequency: 'BIWEEKLY', isDiscretionary: false },
};

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found');
    return;
  }

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  });

  let updated = 0;

  for (const category of categories) {
    const rule = RULES[category.name.toLowerCase()];
    if (!rule) continue;

    const shouldUpdate =
      category.defaultStrategy !== rule.strategy ||
      category.expectedFrequency !== rule.expectedFrequency ||
      category.isDiscretionary !== rule.isDiscretionary;

    if (!shouldUpdate) continue;

    await prisma.category.update({
      where: { id: category.id },
      data: {
        defaultStrategy: rule.strategy,
        expectedFrequency: rule.expectedFrequency,
        isDiscretionary: rule.isDiscretionary,
      },
    });

    updated += 1;
    console.log(
      `Updated ${category.name}: strategy=${rule.strategy}, frequency=${rule.expectedFrequency}, discretionary=${rule.isDiscretionary}`
    );
  }

  console.log('');
  console.log(`Category tuning complete. Updated ${updated} categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
