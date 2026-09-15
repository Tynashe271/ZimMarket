import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Accepts Zimbabwean national format (0771234567) as well as E.164 (+263771234567) and
// normalizes to E.164 so phone numbers are stored and looked up consistently regardless
// of which format the user typed.
export function normalizePhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const parsed = parsePhoneNumberFromString(value, 'ZW');
  return parsed?.isValid() ? parsed.number : value;
}
