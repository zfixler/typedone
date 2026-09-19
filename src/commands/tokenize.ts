export type TokenizeResult =
  { status: 'success'; tokens: string[] } | { status: 'incomplete'; message: string };

export function tokenize(input: string): TokenizeResult {
  const tokens: string[] = [];
  let current = '';
  let quoted = false;

  for (const character of input.trim()) {
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (/\s/.test(character) && !quoted) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += character;
  }
  if (quoted) return { status: 'incomplete', message: 'Close the quoted value with ".' };
  if (current) tokens.push(current);
  return { status: 'success', tokens };
}
