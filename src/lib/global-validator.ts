import { z } from "zod";

/**
 * Standard validation error matching HTTP 400.
 */
export class ValidationError extends Error {
  status: number = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}



/**
 * Global Validator Service & Utility
 *
 * Enforces the global validation rule across the NetRent system:
 * 1. Converts all inputs to UPPERCASE.
 * 2. Blocks all special characters by default.
 * 3. Allows only '_' (underscore) and '-' (hyphen) as exceptions.
 *
 * Centralized for reuse across all code paths:
 * - UI: Input component, form dialogs, client-side handlers
 * - API: Request body parsing, Zod schemas, route handlers
 * - DB: Prisma Client extension query middleware before persistence
 * - Import: Spreadsheet cell coercion and data ingestion
 */

export interface GlobalValidatorOptions {
  /**
   * Whether to allow spaces in the input. Default is false (blocks spaces as special characters).
   */
  allowSpaces?: boolean;
  /**
   * Additional exceptions to allow beyond '_' and '-'. Default is none.
   */
  additionalAllowedChars?: string[];
  /**
   * If true, preserves original casing instead of converting to UPPERCASE. Default is false.
   */
  preserveCase?: boolean;
  /**
   * Maximum allowed length for code (default: 100).
   */
  maxLength?: number;
  /**
   * Custom error message to return on validation failure.
   */
  customErrorMessage?: string;
}

export interface ValidationResult {
  isValid: boolean;
  value: string;
  error?: string;
  blockedCharacters?: string[];
}

/** Maximum length allowed for any code field */
export const MAX_CODE_LENGTH = 100;

/** Default allowed exception characters */
export const DEFAULT_ALLOWED_EXCEPTIONS = ["_", "-"] as const;

/** Technical, security, date, or ID fields that must not have business uppercase/symbol-stripping applied */
export const EXCLUDED_FIELD_NAMES = new Set([
  "id",
  "companyId",
  "password",
  "passwordHash",
  "email",
  "fileUrl",
  "url",
  "website",
  "ipAddress",
  "secret",
  "token",
  "sessionToken",
  "hash",
  "salt",
  "avatarUrl",
  "filePath",
  "fileName",
  "mimeType",
]);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAllowedRegex(options?: GlobalValidatorOptions): RegExp {
  const allowSpaces = options?.allowSpaces ?? false;
  const extra = (options?.additionalAllowedChars ?? []).map(escapeRegex).join("");
  const space = allowSpaces ? " " : "";
  return new RegExp(`^[A-Z0-9_\\-${space}${extra}]*$`);
}

function buildDisallowedRegex(options?: GlobalValidatorOptions): RegExp {
  const allowSpaces = options?.allowSpaces ?? false;
  const extra = (options?.additionalAllowedChars ?? []).map(escapeRegex).join("");
  const space = allowSpaces ? " " : "";
  return new RegExp(`[^A-Z0-9_\\-${space}${extra}]`, "g");
}

export class GlobalValidator {
  /**
   * Normalizes an input value:
   * - Converts null/undefined to empty string
   * - Converts to UPPERCASE by default (unless preserveCase is true)
   */
  static normalize(input: unknown, options?: GlobalValidatorOptions): string {
    if (input === null || input === undefined) return "";
    let str = String(input);
    if (!options?.preserveCase) {
      str = str.toUpperCase();
    }
    return str;
  }

  /**
   * Finds all blocked/disallowed special characters in the input.
   */
  static findBlockedCharacters(input: unknown, options?: GlobalValidatorOptions): string[] {
    if (input === null || input === undefined || input === "") return [];
    const str = GlobalValidator.normalize(input, options);
    const disallowedPattern = buildDisallowedRegex(options);
    const matches = str.match(disallowedPattern);
    return matches ? Array.from(new Set(matches)) : [];
  }

  /**
   * Checks whether the input strictly conforms to the global validation rule:
   * - Must contain only uppercase alphanumeric characters, '_' and '-' (and options if specified).
   */
  static isValid(input: unknown, options?: GlobalValidatorOptions): boolean {
    if (input === null || input === undefined || input === "") return true;
    const str = GlobalValidator.normalize(input, options);
    const maxLen = options?.maxLength ?? MAX_CODE_LENGTH;
    if (maxLen && str.length > maxLen) return false;
    const pattern = buildAllowedRegex(options);
    return pattern.test(str);
  }

  /**
   * Validates an input value:
   * - Converts to UPPERCASE
   * - Enforces maximum length of 100 characters
   * - Checks for any blocked special characters
   * Returns a ValidationResult with `isValid`, normalized `value`, and `error` if invalid.
   */
  static validate(input: unknown, options?: GlobalValidatorOptions): ValidationResult {
    const value = GlobalValidator.normalize(input, options);
    const maxLen = options?.maxLength ?? MAX_CODE_LENGTH;

    if (maxLen && value.length > maxLen) {
      return {
        isValid: false,
        value,
        error: `Code length (${value.length}) exceeds maximum allowed length of ${maxLen} characters.`,
      };
    }

    const blocked = GlobalValidator.findBlockedCharacters(input, options);

    if (blocked.length === 0) {
      return { isValid: true, value };
    }

    const blockedList = blocked.map((c) => (c === " " ? "<space>" : `'${c}'`)).join(", ");
    const errorMsg =
      options?.customErrorMessage ??
      `Special characters (${blockedList}) are blocked. Only uppercase alphanumeric characters, '_' and '-' are allowed.`;

    return {
      isValid: false,
      value,
      error: errorMsg,
      blockedCharacters: blocked,
    };
  }

  /**
   * Sanitizes input by:
   * - Converting to UPPERCASE
   * - Stripping all disallowed special characters (preserving only A-Z, 0-9, '_', and '-')
   * - Truncating to maximum code length of 100
   */
  static sanitize(input: unknown, options?: GlobalValidatorOptions): string {
    if (input === null || input === undefined) return "";
    const normalized = GlobalValidator.normalize(input, options);
    const disallowedPattern = buildDisallowedRegex(options);
    const cleaned = normalized.replace(disallowedPattern, "");
    const maxLen = options?.maxLength ?? MAX_CODE_LENGTH;
    if (maxLen && cleaned.length > maxLen) {
      return cleaned.slice(0, maxLen);
    }
    return cleaned;
  }

  /**
   * Validates input or throws an HttpError(400) if special characters are present.
   */
  static validateOrThrow(
    input: unknown,
    fieldName?: string,
    options?: GlobalValidatorOptions
  ): string {
    const result = GlobalValidator.validate(input, options);
    if (!result.isValid) {
      const fieldPrefix = fieldName ? `Field '${fieldName}': ` : "";
      throw new ValidationError(`Validation error: ${fieldPrefix}${result.error}`);
    }
    return result.value;
  }

  /**
   * Returns whether a field name should be excluded from uppercase/symbol-blocking rules.
   */
  static isExcludedField(fieldName: string): boolean {
    if (EXCLUDED_FIELD_NAMES.has(fieldName)) return true;
    if (fieldName.endsWith("Id")) return true;
    if (/password|token|secret|hash|salt|email|url|website|ipaddress/i.test(fieldName)) return true;
    if (/date|at$/i.test(fieldName)) return true;
    return false;
  }

  /**
   * Determines whether a field name represents a code/identifier:
   * - code, branchCode, shopCode, providerCode, serviceCode, companyCode
   * - contractNumber, invoiceNumber
   * - reference (payment reference code)
   * - customerId, ispServiceId, accountId
   */
  static isCodeField(fieldName: string): boolean {
    if (!fieldName) return false;
    const lower = fieldName.toLowerCase().trim();
    if (
      lower === "code" ||
      lower === "servicecode" ||
      lower === "branchcode" ||
      lower === "shopcode" ||
      lower === "providercode" ||
      lower === "companycode" ||
      lower === "contractnumber" ||
      lower === "invoicenumber" ||
      lower === "reference" ||
      lower === "customerid" ||
      lower === "ispserviceid" ||
      lower === "accountid"
    ) {
      return true;
    }
    if (lower.endsWith("code") || lower.startsWith("code")) {
      return true;
    }
    if (lower.endsWith("number") && !lower.includes("phone") && !lower.includes("duration")) {
      return true;
    }
    return false;
  }

  /**
   * Checks if a value is a plain JavaScript object (e.g. { ... }),
   * excluding class instances like Prisma.Decimal, Date, Buffer, etc.
   */
  static isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
  }

  /**
   * Validates and normalizes an API payload object:
   * - Only applies uppercase and special character blocking where field is used for code!
   * - Non-code fields (name, address, city, notes, phone, etc.) are passed through untouched.
   */
  static processApiPayload<T>(
    payload: T,
    options?: { allowSpaces?: boolean; strict?: boolean }
  ): T {
    if (!payload || typeof payload !== "object") return payload;
    if (Array.isArray(payload)) {
      return payload.map((item) =>
        GlobalValidator.processApiPayload(item, options)
      ) as unknown as T;
    }
    if (!GlobalValidator.isPlainObject(payload)) {
      return payload;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (GlobalValidator.isExcludedField(key)) {
        result[key] = value;
        continue;
      }

      // Enforce uppercase and block special characters ONLY where field is used for code!
      if (GlobalValidator.isCodeField(key) && typeof value === "string") {
        const fieldOptions: GlobalValidatorOptions = {
          allowSpaces: options?.allowSpaces ?? false,
        };
        const validation = GlobalValidator.validate(value, fieldOptions);
        if (!validation.isValid) {
          throw new ValidationError(
            `Validation failed for code field '${key}': ${validation.error}`
          );
        }
        result[key] = validation.value;
      } else if (value && typeof value === "object" && GlobalValidator.isPlainObject(value)) {
        result[key] = GlobalValidator.processApiPayload(value, options);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }

  /**
   * Sanitizes and validates data before writing to the database:
   * - Enforces UPPERCASE and special character sanitization ONLY where field is used for code!
   * - Non-code text fields (name, address, notes, manager, etc.) retain their original text.
   * - Preserves Decimal instances, Dates, and class prototypes.
   */
  static sanitizeAndValidateDbInput<T>(data: T, _model?: string): T {
    if (!data || typeof data !== "object") return data;
    if (Array.isArray(data)) {
      return data.map((item) =>
        GlobalValidator.sanitizeAndValidateDbInput(item, _model)
      ) as unknown as T;
    }
    if (!GlobalValidator.isPlainObject(data)) {
      return data;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (GlobalValidator.isExcludedField(key)) {
        result[key] = value;
        continue;
      }

      // Only enforce uppercase & special character sanitization where field is used for code!
      if (GlobalValidator.isCodeField(key) && typeof value === "string") {
        result[key] = GlobalValidator.sanitize(value);
      } else if (value && typeof value === "object" && GlobalValidator.isPlainObject(value)) {
        result[key] = GlobalValidator.sanitizeAndValidateDbInput(value, _model);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }

  /**
   * Creates a reusable Zod string validator configured with the global validation rule.
   */
  static zodString(options?: GlobalValidatorOptions) {
    const maxLen = options?.maxLength ?? MAX_CODE_LENGTH;
    return z
      .string()
      .max(maxLen, `Code cannot exceed ${maxLen} characters`)
      .transform((val) => GlobalValidator.normalize(val, options))
      .refine((val) => GlobalValidator.isValid(val, options), {
        message:
          options?.customErrorMessage ??
          `Must be uppercase alphanumeric characters; only '_' and '-' are allowed as special characters (max ${maxLen} chars).`,
      });
  }
}

// Re-export convenience functions
export const globalValidate = GlobalValidator.validate;
export const globalSanitize = GlobalValidator.sanitize;
export const globalIsValid = GlobalValidator.isValid;
export const zodGlobalString = GlobalValidator.zodString;
export const isCodeField = GlobalValidator.isCodeField;
export { MAX_CODE_LENGTH as CODE_MAX_LENGTH };


