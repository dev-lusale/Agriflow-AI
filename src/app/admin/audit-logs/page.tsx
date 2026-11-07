import type { Metadata } from "next";
import Link from "next/link";
import { Card, Input, Table, THead, TBody, TR, TH, TD, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit logs" };
const PAGE = 50;

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePageRole("ADMIN", "SUPER_ADMIN");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = sp.q ? { OR: [{ action: { contains: sp.q, mode: "insensitive" as const } }, { entityType: { contains: sp.q, mode: "insensitive" as const } }, { entityId: sp.q }] } : {};
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { email: true, role: true, profile: { select: { fullName: true } } } } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <>
      <PageHeader title="Audit logs" description="Important actions: registrations, moderation, verifications, order and delivery changes, settings and role changes." />
      <form className="mb-4 flex gap-2" method="get">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Filter by action, entity or ID…" />
        <Button type="submit">Filter</Button>
      </form>
      <Card>
        <Table>
          <THead>
            <tr>
              <TH>When</TH>
              <TH>Actor</TH>
              <TH>Action</TH>
              <TH>Entity</TH>
              <TH>Details</TH>
            </tr>
          </THead>
          <TBody>
            {logs.map((l) => (
              <TR key={l.id}>
                <TD className="whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</TD>
                <TD className="text-sm">
                  {l.actor?.profile?.fullName ?? "System"}
                  {l.actor && <Badge className="ml-1">{l.actor.role.toLowerCase()}</Badge>}
                </TD>
                <TD>
                  <code className="rounded bg-navy-100 px-1.5 py-0.5 text-xs">{l.action}</code>
                </TD>
                <TD className="text-xs">
                  {l.entityType}
                  {l.entityId && <span className="text-navy-400"> · {l.entityId.slice(0, 10)}…</span>}
                </TD>
                <TD className="max-w-xs truncate text-xs text-navy-500">{l.metadata ? JSON.stringify(l.metadata) : ""}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <div className="mt-4 flex items-center justify-center gap-2 text-sm">
        {page > 1 && (
          <Button asChild size="sm" variant="outline">
            <Link href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page - 1) })}`}>Previous</Link>
          </Button>
        )}
        <span className="text-navy-500">
          Page {page} of {pages} · {total} entries
        </span>
        {page < pages && (
          <Button asChild size="sm" variant="outline">
            <Link href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page + 1) })}`}>Next</Link>
          </Button>
        )}
      </div>
    </>
  );
}
