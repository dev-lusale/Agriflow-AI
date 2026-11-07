import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/action";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { messageSchema } from "@/lib/validation/schemas";
import { notify } from "@/server/notifications/service";

export async function listConversations(actor: Actor) {
  const convs = await prisma.conversation.findMany({
    where: { participants: { some: { userId: actor.id } } },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: { include: { user: { select: { id: true, role: true, profile: { select: { fullName: true } } } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    take: 100,
  });
  return convs.map((c) => {
    const me = c.participants.find((p) => p.userId === actor.id);
    const last = c.messages[0];
    return { ...c, unread: Boolean(last && last.senderId !== actor.id && (!me?.lastReadAt || me.lastReadAt < last.createdAt)) };
  });
}

export async function getConversation(actor: Actor, id: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: { include: { user: { select: { id: true, role: true, profile: { select: { fullName: true } } } } } },
      messages: { orderBy: { createdAt: "asc" }, take: 300, include: { sender: { select: { id: true, profile: { select: { fullName: true } } } } } },
      order: { select: { id: true, orderNumber: true, status: true, type: true, buyerId: true } },
      listing: { select: { id: true, title: true } },
    },
  });
  if (!conv) throw notFound("Conversation not found.");
  if (!conv.participants.some((p) => p.userId === actor.id)) throw forbidden("You are not part of this conversation.");
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: id, userId: actor.id } },
    data: { lastReadAt: new Date() },
  });
  return conv;
}

/** Send a message in an existing conversation, or start one with a listing's farmer / another user. */
export async function sendMessage(actor: Actor, input: z.input<typeof messageSchema>) {
  const d = messageSchema.parse(input);
  let conversationId = d.conversationId;
  let isNewEnquiry = false;
  if (conversationId) {
    const part = await prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId: actor.id } } });
    if (!part) throw forbidden("You are not part of this conversation.");
  } else {
    let recipientId = d.recipientId;
    let subject = d.subject ?? "Marketplace enquiry";
    if (d.listingId) {
      const listing = await prisma.produceListing.findUnique({ where: { id: d.listingId } });
      if (!listing) throw notFound("Listing not found.");
      recipientId = listing.farmerId;
      subject = `Enquiry: ${listing.title}`;
    }
    if (!recipientId) throw invalid("Choose who to message.");
    if (recipientId === actor.id) throw invalid("You cannot message yourself.");
    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient || recipient.status !== "ACTIVE") throw notFound("Recipient not found.");
    const existing = await prisma.conversation.findFirst({
      where: {
        listingId: d.listingId ?? null,
        orderId: null,
        AND: [{ participants: { some: { userId: actor.id } } }, { participants: { some: { userId: recipientId } } }],
      },
    });
    if (existing) conversationId = existing.id;
    else {
      const created = await prisma.conversation.create({
        data: { subject, listingId: d.listingId, participants: { create: [{ userId: actor.id, lastReadAt: new Date() }, { userId: recipientId }] } },
      });
      conversationId = created.id;
      isNewEnquiry = Boolean(d.listingId);
    }
  }
  const msg = await prisma.message.create({ data: { conversationId, senderId: actor.id, body: d.body } });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: actor.id } },
    data: { lastReadAt: new Date() },
  });
  const others = await prisma.conversationParticipant.findMany({ where: { conversationId, NOT: { userId: actor.id } } });
  for (const o of others) {
    await notify(o.userId, {
      type: isNewEnquiry ? "BUYER_INQUIRY" : "NEW_MESSAGE",
      title: isNewEnquiry ? "New buyer enquiry" : "New message",
      body: d.body.slice(0, 160),
      link: `/messages/${conversationId}`,
    });
  }
  return { conversationId, message: msg };
}

export async function unreadConversationCount(userId: string) {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "ConversationParticipant" cp
    WHERE cp."userId" = ${userId} AND EXISTS (
      SELECT 1 FROM "Message" m WHERE m."conversationId" = cp."conversationId" AND m."senderId" <> ${userId}
      AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt"))`;
  return Number(rows[0]?.count ?? 0);
}
