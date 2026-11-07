import "server-only";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/action";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { hashPassword, passwordProblems } from "@/lib/auth/password";
import { notify } from "@/server/notifications/service";

export function assertAdmin(actor: Actor) {
  if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") throw forbidden();
}

const PAGE = 25;

/** Admin user directory. Never returns password hashes. */
export async function listUsers(actor: Actor, opts: { role?: Role; q?: string; page?: number; status?: "ACTIVE" | "SUSPENDED" } = {}) {
  assertAdmin(actor);
  const where: Prisma.UserWhereInput = {
    ...(opts.role ? { role: opts.role } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.q
      ? {
          OR: [
            { email: { contains: opts.q, mode: "insensitive" } },
            { phone: { contains: opts.q } },
            { profile: { fullName: { contains: opts.q, mode: "insensitive" } } },
            { supplierProfile: { businessName: { contains: opts.q, mode: "insensitive" } } },
            { transporterProfile: { businessName: { contains: opts.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const page = Math.max(1, opts.page ?? 1);
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        verifiedAt: true,
        emailVerifiedAt: true,
        onboardingCompletedAt: true,
        isDemo: true,
        createdAt: true,
        lastLoginAt: true,
        profile: { select: { fullName: true, province: true, district: true } },
        supplierProfile: { select: { businessName: true } },
        transporterProfile: { select: { businessName: true, serviceProvinces: true } },
        buyerProfile: { select: { businessName: true, buyerType: true } },
        farmerProfile: { select: { mainCrops: true, farmingType: true } },
        _count: { select: { farms: true, listings: true, ordersAsBuyer: true, ordersAsSeller: true, supplierProducts: true, deliveriesAssigned: true } },
      },
    }),
  ]);
  return { total, users, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function setUserVerified(actor: Actor, userId: string, verified: boolean) {
  assertAdmin(actor);
  const u = await prisma.user.update({ where: { id: userId }, data: { verifiedAt: verified ? new Date() : null } });
  await audit({ actorId: actor.id, action: verified ? "user.verify" : "user.unverify", entityType: "User", entityId: userId });
  if (verified) await notify(userId, { type: "ACCOUNT", title: "Account verified", body: "An AgriFlow administrator verified your account. A verified badge now shows on your profile.", link: "/" });
  return u;
}

export async function setUserStatus(actor: Actor, userId: string, status: "ACTIVE" | "SUSPENDED", reason?: string) {
  assertAdmin(actor);
  if (userId === actor.id) throw invalid("You cannot change your own status.");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw notFound();
  if ((target.role === "ADMIN" || target.role === "SUPER_ADMIN") && actor.role !== "SUPER_ADMIN") throw forbidden("Only a super administrator can change administrator accounts.");
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status } }),
    ...(status === "SUSPENDED" ? [prisma.session.deleteMany({ where: { userId } })] : []),
  ]);
  await audit({ actorId: actor.id, action: `user.${status.toLowerCase()}`, entityType: "User", entityId: userId, metadata: { reason: reason ?? null } });
}

/** Super admins create administrator accounts. */
export async function createAdmin(actor: Actor, input: { email: string; fullName: string; password: string; role: "ADMIN" | "SUPER_ADMIN" }) {
  if (actor.role !== "SUPER_ADMIN") throw forbidden("Only a super administrator can create administrators.");
  const problem = passwordProblems(input.password);
  if (problem) throw invalid(problem);
  const email = input.email.toLowerCase().trim();
  if (await prisma.user.findUnique({ where: { email } })) throw invalid("Email already registered.");
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(input.password), role: input.role, emailVerifiedAt: new Date(), onboardingCompletedAt: new Date(), dataConsentAt: new Date(), profile: { create: { fullName: input.fullName } } },
  });
  await audit({ actorId: actor.id, action: "admin.create", entityType: "User", entityId: user.id, metadata: { role: input.role } });
  return user;
}

export async function setUserRole(actor: Actor, userId: string, role: "ADMIN" | "SUPER_ADMIN") {
  if (actor.role !== "SUPER_ADMIN") throw forbidden("Only a super administrator can change administrator permissions.");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || (target.role !== "ADMIN" && target.role !== "SUPER_ADMIN")) throw invalid("Only administrator accounts can be changed here.");
  if (userId === actor.id) throw invalid("You cannot change your own role.");
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await audit({ actorId: actor.id, action: "admin.role_change", entityType: "User", entityId: userId, metadata: { from: target.role, to: role } });
}

// ───────── moderation / reference data ─────────

export async function listContentReports(actor: Actor, status: "OPEN" | "RESOLVED" | "DISMISSED" = "OPEN") {
  assertAdmin(actor);
  return prisma.contentReport.findMany({ where: { status }, orderBy: { createdAt: "desc" }, include: { reporter: { select: { email: true, profile: { select: { fullName: true } } } } } });
}

export async function resolveContentReport(actor: Actor, id: string, status: "RESOLVED" | "DISMISSED", resolution?: string) {
  assertAdmin(actor);
  await prisma.contentReport.update({ where: { id }, data: { status, resolution, resolvedById: actor.id, resolvedAt: new Date() } });
  await audit({ actorId: actor.id, action: `report.${status.toLowerCase()}`, entityType: "ContentReport", entityId: id });
}

export async function upsertCrop(actor: Actor, input: { id?: string; name: string; category: string; defaultUnit: string; isActive: boolean }) {
  assertAdmin(actor);
  const data = { name: input.name.trim(), category: input.category.trim(), defaultUnit: input.defaultUnit as never, isActive: input.isActive };
  if (!data.name) throw invalid("Crop name is required.");
  const crop = input.id ? await prisma.crop.update({ where: { id: input.id }, data }) : await prisma.crop.create({ data });
  await audit({ actorId: actor.id, action: input.id ? "crop.update" : "crop.create", entityType: "Crop", entityId: crop.id });
  return crop;
}

export async function upsertCategory(actor: Actor, input: { id?: string; name: string; requiresSafetyInfo: boolean; isActive: boolean }) {
  assertAdmin(actor);
  const slug = input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const data = { name: input.name.trim(), requiresSafetyInfo: input.requiresSafetyInfo, isActive: input.isActive };
  const cat = input.id ? await prisma.productCategory.update({ where: { id: input.id }, data }) : await prisma.productCategory.create({ data: { ...data, slug } });
  await audit({ actorId: actor.id, action: input.id ? "category.update" : "category.create", entityType: "ProductCategory", entityId: cat.id });
  return cat;
}

export async function setDistrictActive(actor: Actor, id: string, isActive: boolean) {
  assertAdmin(actor);
  await prisma.district.update({ where: { id }, data: { isActive } });
  await audit({ actorId: actor.id, action: "district.update", entityType: "District", entityId: id, metadata: { isActive } });
}

export async function moderateProduct(actor: Actor, id: string, action: "VERIFY" | "UNVERIFY" | "REMOVE" | "RESTORE") {
  assertAdmin(actor);
  const data: Prisma.SupplierProductUpdateInput =
    action === "VERIFY" ? { verification: "VERIFIED" } : action === "UNVERIFY" ? { verification: "UNVERIFIED" } : action === "REMOVE" ? { moderationStatus: "REMOVED", isActive: false } : { moderationStatus: "APPROVED" };
  const p = await prisma.supplierProduct.update({ where: { id }, data });
  await audit({ actorId: actor.id, action: `product.${action.toLowerCase()}`, entityType: "SupplierProduct", entityId: id });
  return p;
}
