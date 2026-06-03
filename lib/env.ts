type EnvResult<R extends readonly string[], O extends readonly string[]> =
  | { error: string; values: Record<string, undefined> }
  | { error: null; values: Record<R[number], string> & Record<O[number], string | undefined> };

/**
 * Load environment variables with type-safe required/optional distinction.
 * Returns an error message if any required variable is missing.
 */
export function loadEnv<
  R extends readonly string[],
  O extends readonly string[] = readonly []
>(required: R, optional?: O): EnvResult<R, O> {
  const values: Record<string, string | undefined> = {};
  const missing: string[] = [];

  for (const key of required) {
    const val = process.env[key];
    if (!val) {
      missing.push(key);
    } else {
      values[key] = val;
    }
  }

  if (optional) {
    for (const key of optional) {
      values[key] = process.env[key];
    }
  }

  if (missing.length > 0) {
    return {
      error: `Missing required environment variable(s): ${missing.join(', ')}`,
      values: {} as Record<string, undefined>,
    };
  }

  return {
    error: null,
    values: values as Record<R[number], string> & Record<O[number], string | undefined>,
  };
}
