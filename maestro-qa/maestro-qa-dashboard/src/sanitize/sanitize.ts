const ANSI_PATTERN = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\)|[@-_])/g;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const BEARER_PATTERN = /(bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi;
const ASSIGNMENT_PATTERN =
  /((?:authorization|cookie|set-cookie|refresh[_-]?token|access[_-]?token|id[_-]?token)\s*[:=]\s*)(\S+)/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

export function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, "");
}

export function sanitizeText(input: string): string {
  const clean = stripAnsi(input).replace(/\u0000/g, "");
  const redacted = clean
    .replace(JWT_PATTERN, "[redacted-jwt]")
    .replace(BEARER_PATTERN, "$1[redacted]")
    .replace(ASSIGNMENT_PATTERN, "$1[redacted]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(CPF_PATTERN, "[redacted-cpf]");
  if (redacted.length <= 2000) return redacted;
  return `${redacted.slice(0, 2000)}…`;
}

export function sanitizeOptional(input: string | null | undefined): string | null {
  if (input == null || input === "") return null;
  return sanitizeText(input);
}
