import { describe, it, expect } from 'vitest';
import { validateStationCode, validateLineCode, WMATAError } from './error-handler';

describe('validateStationCode', () => {
  it('should accept valid station codes', () => {
    expect(() => validateStationCode('A01')).not.toThrow();
    expect(() => validateStationCode('C15')).not.toThrow();
    expect(() => validateStationCode('N06')).not.toThrow();
  });

  it('should handle case insensitive input', () => {
    expect(() => validateStationCode('a01')).not.toThrow();
    expect(() => validateStationCode('c15')).not.toThrow();
  });

  it('should trim whitespace', () => {
    expect(() => validateStationCode(' A01 ')).not.toThrow();
    expect(() => validateStationCode('\tC15\n')).not.toThrow();
  });

  it('should reject invalid formats', () => {
    expect(() => validateStationCode('ABC')).toThrow(WMATAError);
    expect(() => validateStationCode('A1')).toThrow(WMATAError);
    expect(() => validateStationCode('123')).toThrow(WMATAError);
    expect(() => validateStationCode('')).toThrow(WMATAError);
    expect(() => validateStationCode('A001')).toThrow(WMATAError);
  });

  it('should return normalized uppercase code', () => {
    expect(validateStationCode('a01')).toBe('A01');
    expect(validateStationCode(' c15 ')).toBe('C15');
  });
});

describe('validateLineCode', () => {
  it('should accept valid line codes', () => {
    expect(() => validateLineCode('RD')).not.toThrow();
    expect(() => validateLineCode('BL')).not.toThrow();
    expect(() => validateLineCode('YL')).not.toThrow();
    expect(() => validateLineCode('OR')).not.toThrow();
    expect(() => validateLineCode('GR')).not.toThrow();
    expect(() => validateLineCode('SV')).not.toThrow();
  });

  it('should handle case insensitive input', () => {
    expect(() => validateLineCode('rd')).not.toThrow();
    expect(() => validateLineCode('Bl')).not.toThrow();
  });

  it('should trim whitespace', () => {
    expect(() => validateLineCode(' RD ')).not.toThrow();
    expect(() => validateLineCode('\tBL\n')).not.toThrow();
  });

  it('should reject invalid line codes', () => {
    expect(() => validateLineCode('XX')).toThrow(WMATAError);
    expect(() => validateLineCode('RED')).toThrow(WMATAError);
    expect(() => validateLineCode('R')).toThrow(WMATAError);
    expect(() => validateLineCode('')).toThrow(WMATAError);
  });

  it('should return normalized uppercase code', () => {
    expect(validateLineCode('rd')).toBe('RD');
    expect(validateLineCode(' bl ')).toBe('BL');
  });
});

describe('WMATAError', () => {
  it('should create error with message and statusCode', () => {
    const error = new WMATAError('Test error', 400);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error).toBeInstanceOf(Error);
  });

  it('should handle optional statusCode', () => {
    const error = new WMATAError('Test error');
    expect(error.statusCode).toBeUndefined();
  });
});