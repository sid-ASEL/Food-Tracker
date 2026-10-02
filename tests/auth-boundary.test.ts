import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getDb: vi.fn(), owner: vi.fn() }));
vi.mock("next-auth", () => ({ default: () => ({ auth: mocks.auth, handlers: {}, signIn: vi.fn(), signOut: vi.fn() }) }));
vi.mock("@/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/db/accounts", () => ({ Accounts: class { owner = mocks.owner; register = vi.fn(); } }));
import { requireOwner } from "@/auth";
import { refreshData } from "@/app/actions";

beforeEach(() => { vi.clearAllMocks(); });
describe("server authentication boundary", () => {
  it("rejects absent and legacy sessions before connecting to the database", async () => {
    for (const session of [null, { user: { email: "owner@gmail.com" } }]) {
      mocks.auth.mockResolvedValue(session);
      await expect(requireOwner()).rejects.toThrow("sign in");
      expect(await refreshData()).toMatchObject({ ok: false, error: expect.stringContaining("sign in") });
    }
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.owner).not.toHaveBeenCalled();
  });
  it("resolves ownership from the signed Google identity instead of email or supplied owner", async () => {
    mocks.auth.mockResolvedValue({ googleId: "trusted-google-sub", owner: "victim", user: { email: "renamed@gmail.com" } });
    mocks.owner.mockResolvedValue("private-owner-key");
    expect(await requireOwner()).toBe("private-owner-key");
    expect(mocks.owner).toHaveBeenCalledWith("trusted-google-sub");
  });
  it("does not create an account when a session mapping is missing", async () => {
    mocks.auth.mockResolvedValue({ googleId: "unmapped" });
    mocks.owner.mockRejectedValue(new Error("Please sign in again"));
    await expect(requireOwner()).rejects.toThrow("sign in again");
  });
});
