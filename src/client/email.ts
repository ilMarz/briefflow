/** Light check for enabling the submit button; the server validates the address for real. */
export const validEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
/** Prefilled in the demo forms. The domain is reserved for examples (RFC 2606), so it can never reach a real person. */
export const DEFAULT_TEST_EMAIL = "cliente.test@example.com";
