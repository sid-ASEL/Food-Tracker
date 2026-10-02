import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { accounts, services } from "./schema";
import type { GoogleIdentity } from "@/lib/access";
import { UserError } from "@/lib/errors";

export class Accounts {
  constructor(private db: NodePgDatabase<typeof schema>) {}
  async register(identity: GoogleIdentity) {
    return this.db.transaction(async tx => {
      const [existing] = await tx.select().from(accounts).where(eq(accounts.googleId, identity.googleId));
      if (!existing) {
        const [legacy] = identity.canClaimLegacy ? await tx.select({ id: services.id }).from(services).where(eq(services.owner, identity.email)).limit(1) : [];
        const newOwner = `google:${identity.googleId}`;
        await tx.insert(accounts).values({ googleId: identity.googleId, ownerKey: legacy ? identity.email : newOwner, email: identity.email, name: identity.name }).onConflictDoNothing();
        // A different identity may already own the legacy key. Never share it.
        const [registered] = await tx.select().from(accounts).where(eq(accounts.googleId, identity.googleId));
        if (!registered) await tx.insert(accounts).values({ googleId: identity.googleId, ownerKey: newOwner, email: identity.email, name: identity.name }).onConflictDoNothing();
      }
      const [account] = await tx.update(accounts).set({ email: identity.email, name: identity.name }).where(eq(accounts.googleId, identity.googleId)).returning();
      if (!account) throw new UserError("Could not create your tracker. Please try signing in again.");
      return account;
    });
  }
  async owner(googleId: string) {
    const [account] = await this.db.select({ owner: accounts.ownerKey }).from(accounts).where(eq(accounts.googleId, googleId));
    if (!account) throw new UserError("Please sign in again to open your tracker.");
    return account.owner;
  }
}
