import { WhereClause, OrderByClause, WhereOperator } from '@shared/ipc-types';

const INEQUALITY_OPERATORS: Set<WhereOperator> = new Set([
  '<',
  '<=',
  '>',
  '>=',
  '!=',
  'not-in',
]);

export interface QueryValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates Firestore compound query constraints client-side before execution:
 * 1. Inequalities (<, <=, >, >=, !=, not-in) must all target the same field.
 * 2. At most one array-contains or array-contains-any clause.
 * 3. At most one in, not-in, or array-contains-any clause across the query.
 * 4. If an inequality filter exists, the first orderBy clause must match the inequality field.
 * 5. Disallow orderBy on a field that already has an equality (==) filter.
 */
export function validateFirestoreQuery(
  whereClauses: WhereClause[],
  orderByClauses: OrderByClause[]
): QueryValidationResult {
  if (!whereClauses || whereClauses.length === 0) {
    return { isValid: true };
  }

  // 1. Check inequality field consistency
  const inequalityFields = new Set<string>();
  for (const clause of whereClauses) {
    if (INEQUALITY_OPERATORS.has(clause.operator)) {
      inequalityFields.add(clause.field);
    }
  }

  if (inequalityFields.size > 1) {
    const fieldsList = Array.from(inequalityFields).map((f) => `"${f}"`).join(', ');
    return {
      isValid: false,
      error: `Firestore constraint violation: All inequality filters (<, <=, >, >=, !=, not-in) must target the same field. Found inequalities across multiple fields: ${fieldsList}.`,
    };
  }

  // 2. At most one array-contains or array-contains-any clause
  let arrayContainsCount = 0;
  for (const clause of whereClauses) {
    if (clause.operator === 'array-contains' || clause.operator === 'array-contains-any') {
      arrayContainsCount++;
    }
  }

  if (arrayContainsCount > 1) {
    return {
      isValid: false,
      error: `Firestore constraint violation: You can use at most one "array-contains" or "array-contains-any" clause per query. Found ${arrayContainsCount}.`,
    };
  }

  // 3. At most one 'in', 'not-in', or 'array-contains-any' clause across the query
  let disjunctionCount = 0;
  for (const clause of whereClauses) {
    if (
      clause.operator === 'in' ||
      clause.operator === 'not-in' ||
      clause.operator === 'array-contains-any'
    ) {
      disjunctionCount++;
    }
  }

  if (disjunctionCount > 1) {
    return {
      isValid: false,
      error: `Firestore constraint violation: You can combine at most one "in", "not-in", or "array-contains-any" operator per query. Found ${disjunctionCount}.`,
    };
  }

  // 4. If inequality exists, the first orderBy field must match the inequality field
  if (inequalityFields.size === 1 && orderByClauses && orderByClauses.length > 0) {
    const inequalityField = Array.from(inequalityFields)[0];
    const firstOrderField = orderByClauses[0].field;

    if (firstOrderField !== inequalityField) {
      return {
        isValid: false,
        error: `Firestore constraint violation: When filtering by inequality (<, <=, >, >=, !=, not-in) on "${inequalityField}", the first orderBy clause must also be on "${inequalityField}". Currently ordering by "${firstOrderField}".`,
      };
    }
  }

  // 5. Disallow orderBy on a field that already has an equality (==) filter
  const equalityFields = new Set<string>();
  for (const clause of whereClauses) {
    if (clause.operator === '==') {
      equalityFields.add(clause.field);
    }
  }

  if (orderByClauses) {
    for (const order of orderByClauses) {
      if (equalityFields.has(order.field)) {
        return {
          isValid: false,
          error: `Firestore constraint violation: Cannot sort by "${order.field}" because it is already filtered by equality (==).`,
        };
      }
    }
  }

  return { isValid: true };
}
