// Only deliberately user-facing errors may cross the server-action boundary.
export class UserError extends Error {}
