import { normalizePhone } from './phone';
describe('normalizePhone',()=>{
  it('normalizes a Zimbabwean national-format number to E.164',()=>{expect(normalizePhone('0771234567')).toBe('+263771234567')});
  it('leaves an already E.164 number unchanged',()=>{expect(normalizePhone('+263771234567')).toBe('+263771234567')});
  it('returns the original value when it cannot be parsed as a valid phone number',()=>{expect(normalizePhone('not-a-phone')).toBe('not-a-phone')});
  it('passes through non-string values unchanged',()=>{expect(normalizePhone(undefined)).toBeUndefined()});
});
