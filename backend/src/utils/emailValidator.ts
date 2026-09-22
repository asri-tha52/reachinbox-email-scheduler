const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

export function cleanAndDeduplicateRecipients(recipients: string[]): string[] {
  if (!Array.isArray(recipients)) return [];
  const seen = new Set<string>();
  const validList: string[] = [];

  for (const raw of recipients) {
    if (!raw || typeof raw !== 'string') continue;
    const email = raw.trim().toLowerCase();
    if (isValidEmail(email) && !seen.has(email)) {
      seen.add(email);
      validList.push(email);
    }
  }

  return validList;
}

export function parseRecipientsText(rawText: string): string[] {
  if (!rawText) return [];
  // Split by newlines, commas, semicolons, tabs, or whitespace
  const tokens = rawText.split(/[\r\n,;\t]+/);
  return cleanAndDeduplicateRecipients(tokens);
}
