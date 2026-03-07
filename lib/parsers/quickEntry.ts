/**
 * Quick Entry Parser
 *
 * Parses natural language financial entries like:
 *   "45 grocery"
 *   "500 savings"
 *   "3500 paycheck"
 *
 * Extracts: amount, category, and optional description
 */

import { Decimal } from '@prisma/client/runtime/library';

export interface ParsedQuickEntry {
  amount: Decimal;
  category: string | null; // Will need category mapping
  description: string;
  entryType: 'INCOME' | 'EXPENSE' | 'SAVINGS';
  inferred: {
    categoryWasGuessed: boolean;
    descriptionWasGenerated: boolean;
  };
}

/**
 * Category keywords for auto-detection
 *
 * Maps common phrases to category slugs
 */
const CATEGORY_KEYWORDS: Record<string, string> = {
  // Income
  paycheck: 'income',
  salary: 'income',
  wage: 'income',
  income: 'income',
  payment: 'income',

  // Groceries
  grocery: 'grocery',
  groceries: 'grocery',
  costco: 'grocery',
  wholefoods: 'grocery',
  trader: 'grocery',

  // Dining
  lunch: 'spend',
  breakfast: 'spend',
  dinner: 'spend',
  restaurant: 'spend',
  coffee: 'spend',
  cafe: 'spend',
  pizza: 'spend',

  // Gas
  gas: 'other',
  fuel: 'other',
  shell: 'other',
  chevron: 'other',
  exxon: 'other',

  // Transportation
  uber: 'other',
  lyft: 'other',
  transit: 'other',
  parking: 'other',
  bus: 'other',

  // Savings
  savings: 'savings',
  save: 'savings',
  emergency: 'savings',
  fund: 'savings',

  // Entertainment
  movie: 'misc',
  cinema: 'misc',
  theater: 'misc',
  concert: 'misc',
  game: 'misc',
  spotify: 'misc',
  netflix: 'misc',

  // Utilities
  electric: 'other',
  water: 'other',
  internet: 'other',
  phone: 'phone',
  utility: 'other',

  // Healthcare
  doctor: 'other',
  pharmacy: 'other',
  medical: 'other',
  clinic: 'other',
  dental: 'other',
  rent: 'rent',
  debt: 'debt',
  loan: 'debt',
  partnership: 'partnership',
  tithe: 'partnership',
  misc: 'misc',
  other: 'other',
  spend: 'spend',
};

/**
 * Parse quick entry string
 *
 * Format: "[amount] [description]"
 *
 * Examples:
 *   "45 grocery Store" → {amount: 45, category: "groceries", description: "Grocery Store"}
 *   "3500 paycheck" → {amount: 3500, category: "paycheck", description: "Paycheck", type: "INCOME"}
 *   "500 savings" → {amount: 500, category: "savings", description: "Savings", type: "SAVINGS"}
 *   "25.50" → {amount: 25.50, category: null, description: "Expense"}
 *
 * @param input The quick entry string
 * @param defaultCategory Fallback category if none detected
 * @returns Parsed entry with inferred metadata
 */
export function parseQuickEntry(
  input: string,
  defaultCategory: string = 'misc'
): ParsedQuickEntry {
  const trimmed = input.trim();

  // Extract amount (first token that looks like a number)
  const amountMatch = trimmed.match(/^(\d+(?:\.\d{2})?)/);
  if (!amountMatch) {
    throw new Error(`No amount found in: "${input}"`);
  }

  const amount = new Decimal(amountMatch[1]);

  // Get remainder after amount
  const remainder = trimmed.substring(amountMatch[1].length).trim();

  // Infer category from remainder
  const { category, guessed } = inferCategory(remainder);
  const finalCategory = category || defaultCategory;

  // Infer entry type (income vs expense vs savings)
  const entryType = inferEntryType(finalCategory, remainder);

  // Build description
  const description = buildDescription(remainder, finalCategory);

  return {
    amount,
    category: finalCategory,
    description,
    entryType,
    inferred: {
      categoryWasGuessed: guessed,
      descriptionWasGenerated: !remainder,
    },
  };
}

/**
 * Extract amount from string
 *
 * Returns first number found.
 *
 * @example
 *   extractAmount("45 grocery")  // 45
 *   extractAmount("$45.50")      // 45.50
 *   extractAmount("grocery 45")  // 45
 */
export function extractAmount(input: string): Decimal {
  const match = input.match(/(\d+(?:\.\d{2})?)/);
  if (!match) {
    throw new Error(`No valid amount in: "${input}"`);
  }
  return new Decimal(match[1]);
}

/**
 * Infer category from text
 *
 * Matches keywords to known categories.
 * Returns tuple of [category, wasGuessed]
 *
 * @example
 *   inferCategory("starbucks coffee")  // ["dining", true]
 *   inferCategory("paycheck")          // ["paycheck", false]
 */
export function inferCategory(text: string): {
  category: string | null;
  guessed: boolean;
} {
  const lower = text.toLowerCase();

  // Direct word match
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(keyword)) {
      return { category, guessed: false };
    }
  }

  // No match found
  return { category: null, guessed: true };
}

/**
 * Infer entry type from category
 *
 * Rules:
 *   - paycheck, salary, income → INCOME
 *   - savings, emergency fund → SAVINGS
 *   - everything else → EXPENSE
 *
 * @example
 *   inferEntryType("paycheck")  // "INCOME"
 *   inferEntryType("savings")   // "SAVINGS"
 *   inferEntryType("dining")    // "EXPENSE"
 */
export function inferEntryType(
  category: string,
  _text?: string
): 'INCOME' | 'EXPENSE' | 'SAVINGS' {
  const lower = category.toLowerCase();

  if (
    lower.includes('paycheck') ||
    lower.includes('salary') ||
    lower.includes('income') ||
    lower.includes('wage')
  ) {
    return 'INCOME';
  }

  if (lower.includes('saving') || lower.includes('emergency')) {
    return 'SAVINGS';
  }

  return 'EXPENSE';
}

/**
 * Build human-readable description
 *
 * Uses the remainder text if available.
 * Falls back to category-based description.
 *
 * @example
 *   buildDescription("starbucks coffee", "dining")  // "Starbucks Coffee"
 *   buildDescription("", "paycheck")  // "Paycheck"
 */
export function buildDescription(remainder: string, category: string): string {
  if (remainder) {
    // Capitalize first letter of each word
    return remainder
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Generate from category
  const categoryDisplay: Record<string, string> = {
    income: 'Income',
    grocery: 'Grocery',
    spend: 'Spend',
    phone: 'Phone',
    rent: 'Rent',
    debt: 'Debt',
    partnership: 'Partnership',
    other: 'Other',
    misc: 'Misc',
    savings: 'Savings Transfer',
  };

  return categoryDisplay[category.toLowerCase()] || 'Entry';
}

/**
 * Parse multiple quick entry lines
 *
 * Batch process multiple entries.
 * Skips empty lines.
 *
 * @example
 *   parseQuickEntries([
 *     "45 coffee",
 *     "120 groceries",
 *     "3500 paycheck"
 *   ])
 *   // Returns array of 3 parsed entries
 */
export function parseQuickEntries(lines: string[]): ParsedQuickEntry[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => parseQuickEntry(line));
}

/**
 * Validate parsed entry before persisting
 *
 * Checks:
 *   - Amount is positive and reasonable
 *   - Category and type are valid
 *   - Description is not empty
 *
 * @returns [isValid, errorMessage]
 */
export function validateParsedEntry(
  entry: ParsedQuickEntry,
  maxAmount: Decimal = new Decimal(10000)
): [boolean, string | null] {
  if (entry.amount.lessThanOrEqualTo(0)) {
    return [false, 'Amount must be positive'];
  }

  if (entry.amount.greaterThan(maxAmount)) {
    return [false, `Amount exceeds maximum of $${maxAmount.toFixed(2)}`];
  }

  if (!entry.category) {
    return [false, 'Category is required'];
  }

  if (!entry.description || entry.description.trim().length === 0) {
    return [false, 'Description is required'];
  }

  return [true, null];
}
