"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { parseInput, runAction } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";
import { contactSchema } from "@/lib/validation/schemas";
import { notifyMany } from "@/server/notifications/service";

export async function contactAction(fd: FormData) {
  return runAction(async () => {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    await rateLimit(`contact:${ip}`, 5, 3600);
    const d = parseInput(contactSchema, fd);
    const admins = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" }, select: { id: true } });
    await notifyMany(
      admins.map((a) => a.id),
      { type: "SYSTEM", title: `Contact form: ${d.subject.slice(0, 80)}`, body: `${d.name} <${d.email}>: ${d.message.slice(0, 600)}` },
    );
  }, "Thank you. Your message has reached the AgriFlow team.");
}
