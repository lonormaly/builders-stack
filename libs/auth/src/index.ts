// Single public door for @stack/auth.
import { auth } from "./auth";

export { auth };
export { getSession } from "./session";

// Inferred types straight from the configured instance — always in sync with config.
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
