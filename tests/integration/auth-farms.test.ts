import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { authenticate, completeOnboarding, consumeToken, issueToken, registerUser, requestPasswordReset, resetPassword } from "@/server/auth/service";
import { createCropRecord, createFarm, createField, createTask, getFarmDetail, recordActivity, listFarms, updateNote, createNote, calendarEvents } from "@/server/farms/service";
import { financialSummary } from "@/server/finance/service";
import { applySyncBatch } from "@/server/sync/service";
import { makeUser, resetDb } from "./helpers";

let ref: Awaited<ReturnType<typeof resetDb>>;
beforeAll(async () => {
  ref = await resetDb();
});

describe("registration & authentication", () => {
  it("registers a user with hashed password, consent, verification token and welcome notification", async () => {
    const u = await registerUser({ fullName: "Mwila Banda", email: "Mwila@Example.com", password: "maize2026", role: "FARMER", consent: "on" });
    expect(u.email).toBe("mwila@example.com");
    expect(u.passwordHash).not.toContain("maize2026");
    expect(u.dataConsentAt).toBeTruthy();
    expect(await prisma.verificationToken.count({ where: { userId: u.id, type: "EMAIL_VERIFY" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: u.id } })).toBe(1);
    // email not configured → recorded honestly, never claimed as sent
    expect((await prisma.outboundMessage.findFirst({ where: { userId: u.id } }))?.status).toBe("NOT_CONFIGURED");
  });

  it("rejects duplicate emails and wrong passwords", async () => {
    await expect(registerUser({ fullName: "X", email: "mwila@example.com", password: "maize2026", role: "BUYER", consent: "on" })).rejects.toThrow(/already exists/);
    await expect(authenticate("mwila@example.com", "wrong-pass1")).rejects.toThrow(/Incorrect/);
    await expect(authenticate("nobody@example.com", "maize2026")).rejects.toThrow(/Incorrect/);
    expect((await authenticate("MWILA@example.com", "maize2026")).role).toBe("FARMER");
  });

  it("blocks suspended accounts", async () => {
    await prisma.user.update({ where: { email: "mwila@example.com" }, data: { status: "SUSPENDED" } });
    await expect(authenticate("mwila@example.com", "maize2026")).rejects.toThrow(/suspended/);
    await prisma.user.update({ where: { email: "mwila@example.com" }, data: { status: "ACTIVE" } });
  });

  it("resets passwords with single-use tokens and signs out other sessions", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "mwila@example.com" } });
    await prisma.session.create({ data: { userId: user.id, tokenHash: "h1", expiresAt: new Date(Date.now() + 1e6) } });
    await requestPasswordReset("unknown@example.com"); // no error, no enumeration
    const token = await issueToken(user.id, "PASSWORD_RESET");
    await resetPassword(token, "newpass2027");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await expect(consumeToken(token, "PASSWORD_RESET")).rejects.toThrow(/invalid or has expired/);
    expect((await authenticate("mwila@example.com", "newpass2027")).id).toBe(user.id);
  });

  it("completes farmer onboarding with a first farm", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "mwila@example.com" } });
    await completeOnboarding(user.id, "FARMER", { fullName: "Mwila Banda", phone: "0971234567", province: "SOUTHERN", district: "Choma", farmingType: "SMALLHOLDER", mainCrops: ["Maize"], farmName: "Banda Farm", farmSize: "5", sizeUnit: "HECTARES" });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { farms: true, farmerProfile: true } });
    expect(u.onboardingCompletedAt).toBeTruthy();
    expect(u.phone).toBe("+260971234567");
    expect(u.farms[0]?.name).toBe("Banda Farm");
    await expect(completeOnboarding(user.id, "FARMER", { fullName: "x", province: "SOUTHERN", district: "Lusaka", farmingType: "SMALLHOLDER" })).rejects.toThrow(/district/i);
  });
});

describe("farm management & data isolation", () => {
  it("creates farms, fields, crops and activities; activity cost becomes an expense", async () => {
    const farmer = await makeUser("FARMER");
    const farm = await createFarm(farmer, { name: "Choma Plot", province: "SOUTHERN", district: "Choma", size: 5 });
    const field = await createField(farmer, { farmId: farm.id, name: "Field A", area: 3 });
    const crop = await createCropRecord(farmer, { farmId: farm.id, fieldId: field.id, cropId: ref.maize.id, variety: "SC 513", plantingDate: new Date("2026-12-01"), expectedHarvestDate: new Date("2027-04-20"), status: "GROWING" });
    // harvest reminder created automatically
    expect(await prisma.farmTask.count({ where: { cropRecordId: crop.id, source: "SYSTEM" } })).toBe(1);
    await recordActivity(farmer, { farmId: farm.id, fieldId: field.id, cropRecordId: crop.id, type: "FERTILIZER_APPLICATION", date: new Date("2026-12-01"), cost: 21600, recordExpense: "on" });
    const fin = await financialSummary(farmer.id);
    expect(fin.totalExpenses).toBe("21600.00");
    expect(fin.byCategory[0]).toEqual({ name: "FERTILIZER", amount: "21600.00" });
    const detail = await getFarmDetail(farmer, farm.id);
    expect(detail.fields[0]?.status).toBe("PLANTED");
    const events = await calendarEvents(farmer, new Date("2026-11-01"), new Date("2027-05-01"));
    expect(events.map((e) => e.kind)).toEqual(expect.arrayContaining(["PLANTING", "HARVEST", "ACTIVITY", "TASK"]));
  });

  it("prevents access to other farmers' farms and wrong roles", async () => {
    const a = await makeUser("FARMER");
    const b = await makeUser("FARMER");
    const buyer = await makeUser("BUYER");
    const farm = await createFarm(a, { name: "Private Farm", province: "SOUTHERN", district: "Choma", size: 2 });
    await expect(getFarmDetail(b, farm.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createField(b, { farmId: farm.id, name: "Sneaky", area: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createFarm(buyer, { name: "x", province: "SOUTHERN", district: "Choma", size: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await listFarms(b)).length).toBe(0);
  });

  it("rejects a field from another farm on an activity", async () => {
    const f = await makeUser("FARMER");
    const farm1 = await createFarm(f, { name: "One", province: "SOUTHERN", district: "Choma", size: 2 });
    const farm2 = await createFarm(f, { name: "Two", province: "SOUTHERN", district: "Kalomo", size: 2 });
    const field2 = await createField(f, { farmId: farm2.id, name: "F2", area: 1 });
    await expect(recordActivity(f, { farmId: farm1.id, fieldId: field2.id, type: "PLANTING", date: new Date() })).rejects.toThrow(/does not belong/);
  });
});

describe("offline synchronisation", () => {
  it("is idempotent, isolates failures and detects note conflicts", async () => {
    const f = await makeUser("FARMER");
    const farm = await createFarm(f, { name: "Sync Farm", province: "SOUTHERN", district: "Choma", size: 2 });
    const batch = {
      ops: [
        { opId: "op-activity-1", kind: "activity.create", payload: { farmId: farm.id, type: "PLANTING", date: "2026-12-01", cost: "500", recordExpense: "on" } },
        { opId: "op-task-00001", kind: "task.create", payload: { title: "Weed field", dueDate: "2026-12-10", farmId: farm.id } },
        { opId: "op-bad-000001", kind: "activity.create", payload: { farmId: "not-mine", type: "PLANTING", date: "2026-12-01" } },
      ],
    };
    const r1 = await applySyncBatch(f, batch);
    expect(r1.map((r) => r.status)).toEqual(["synced", "synced", "failed"]);
    expect(r1[2]).toMatchObject({ retryable: false });
    const r2 = await applySyncBatch(f, batch); // retry after flaky network
    expect(r2[0]).toMatchObject({ status: "synced", serverId: (r1[0] as { serverId: string }).serverId });
    expect(await prisma.farmActivity.count({ where: { userId: f.id } })).toBe(1);
    expect(await prisma.farmTransaction.count({ where: { userId: f.id } })).toBe(1);

    const note = await createNote(f, { title: "Rain", body: "v1" });
    await updateNote(f, note.id, { title: "Rain", body: "edited online", baseVersion: 1 });
    const r3 = await applySyncBatch(f, { ops: [{ opId: "op-note-upd-1", kind: "note.update", payload: { id: note.id, title: "Rain", body: "edited offline", baseVersion: 1 } }] });
    expect(r3[0]).toMatchObject({ status: "conflict", server: { body: "edited online", version: 2 } });
  });

  it("refuses non-farmer sync and never accepts orders", async () => {
    const buyer = await makeUser("BUYER");
    await expect(applySyncBatch(buyer, { ops: [{ opId: "op-xxxxxxxx", kind: "task.create", payload: {} }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const f = await makeUser("FARMER");
    await expect(applySyncBatch(f, { ops: [{ opId: "op-order-0001", kind: "order.create", payload: {} }] })).rejects.toThrow();
  });

  it("creates tasks with offline clientId only once", async () => {
    const f = await makeUser("FARMER");
    const t1 = await createTask(f, { title: "x", dueDate: new Date(), clientId: "same-client-id" });
    const t2 = await createTask(f, { title: "x", dueDate: new Date(), clientId: "same-client-id" });
    expect(t1.id).toBe(t2.id);
  });
});
