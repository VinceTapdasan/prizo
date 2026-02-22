// Trim + collapse internal whitespace
export function clean(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

// Title case: capitalizes first letter of each word
// Preserves all-caps abbreviations (e.g. "QR", "BGY")
export function toTitleCase(value: string): string {
  return clean(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

// For proper names and addresses — clean + title case
export function sanitizeName(value: string): string {
  return toTitleCase(value);
}

// For optional fields — returns undefined if blank after cleaning
export function sanitizeOptional(value: string): string | undefined {
  const cleaned = sanitizeName(value);
  return cleaned.length > 0 ? cleaned : undefined;
}
