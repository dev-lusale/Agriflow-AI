import Link from "next/link";
import type { Role } from "@prisma/client";
import { BadgeCheck, Plus, Search } from "lucide-react";
import { Badge, Card, Input, Select, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page";
import { ActionButton, ActionForm, SelectField, SubmitButton, TextField } from "@/components/forms/action-form";
import { FormDialog } from "@/components/forms/form-dialog";
import type { SessionUser } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { provinceLabel } from "@/lib/zambia";
import { formatDate, relativeTime } from "@/lib/utils";
import { listUsers } from "@/server/admin/service";
import { createAdminAction, setAdminRoleAction, setUserStatusAction, verifyUserAction } from "@/server/actions/admin";

export async function UserDirectory({ viewer, role, title, description, searchParams, basePath }: { viewer: SessionUser; role?: Role; title: string; description: string; searchParams: { q?: string; page?: string; status?: string; role?: string }; basePath: string }) {
  const filterRole = role ?? ((searchParams.role as Role) || undefined);
  const data = await listUsers({ id: viewer.id, role: viewer.role }, { role: filterRole, q: searchParams.q, page: Number(searchParams.page ?? 1), status: searchParams.status === "SUSPENDED" ? "SUSPENDED" : searchParams.status === "ACTIVE" ? "ACTIVE" : undefined });
  const isSuper = viewer.role === "SUPER_ADMIN";
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          !role &&
          isSuper && (
            <FormDialog trigger={<><Plus /> New administrator</>} title="Create administrator" description="Only super administrators can create admin accounts.">
              <ActionForm action={createAdminAction} className="space-y-3">
                <TextField name="fullName" label="Full name" required />
                <TextField name="email" label="Email" type="email" required />
                <TextField name="password" label="Temporary password" type="password" required hint="8+ characters with letters and numbers. Ask them to change it." />
                <SelectField name="role" label="Role" options={[{ value: "ADMIN", label: "Administrator" }, { value: "SUPER_ADMIN", label: "Super administrator" }]} />
                <SubmitButton>Create</SubmitButton>
              </ActionForm>
            </FormDialog>
          )
        }
      />
      <form method="get" action={basePath} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-400" />
          <Input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search name, email, phone, business…" className="pl-9" />
        </label>
        {!role && (
          <Select name="role" defaultValue={searchParams.role ?? ""} className="sm:w-48" aria-label="Role">
            <option value="">All roles</option>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        )}
        <Select name="status" defaultValue={searchParams.status ?? ""} className="sm:w-40" aria-label="Status">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
        <Button type="submit">Filter</Button>
      </form>
      <p className="mb-2 text-sm text-navy-500">{data.total} accounts</p>
      <Card>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Role</TH>
              <TH>Location</TH>
              <TH>Activity</TH>
              <TH>Joined</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {data.users.map((u) => {
              const biz = u.supplierProfile?.businessName ?? u.transporterProfile?.businessName ?? u.buyerProfile?.businessName;
              const isAdminAcct = u.role === "ADMIN" || u.role === "SUPER_ADMIN";
              const activity =
                u.role === "FARMER"
                  ? `${u._count.farms} farms · ${u._count.listings} listings · ${u._count.ordersAsSeller} sales`
                  : u.role === "BUYER"
                    ? `${u._count.ordersAsBuyer} orders`
                    : u.role === "SUPPLIER"
                      ? `${u._count.supplierProducts} products · ${u._count.ordersAsSeller} orders`
                      : u.role === "TRANSPORTER"
                        ? `${u._count.deliveriesAssigned} deliveries`
                        : "—";
              return (
                <TR key={u.id}>
                  <TD>
                    <p className="flex items-center gap-1 font-medium text-navy-900">
                      {u.profile?.fullName ?? "—"}
                      {u.verifiedAt && <BadgeCheck className="size-4 text-forest-600" aria-label="Verified" />}
                      {u.isDemo && <Badge tone="amber">Demo</Badge>}
                    </p>
                    <p className="text-xs text-navy-500">
                      {u.email}
                      {biz ? ` · ${biz}` : ""}
                    </p>
                  </TD>
                  <TD>{ROLE_LABEL[u.role]}</TD>
                  <TD className="text-sm">{u.profile?.district ? `${u.profile.district}, ${provinceLabel(u.profile.province)}` : "—"}</TD>
                  <TD className="text-xs">{activity}</TD>
                  <TD className="whitespace-nowrap text-xs">
                    {formatDate(u.createdAt)}
                    {u.lastLoginAt && <p className="text-navy-400">seen {relativeTime(u.lastLoginAt)}</p>}
                  </TD>
                  <TD>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={u.status === "ACTIVE" ? "green" : "red"}>{u.status.toLowerCase()}</Badge>
                      {!u.onboardingCompletedAt && !isAdminAcct && <Badge tone="slate">onboarding</Badge>}
                      {!u.emailVerifiedAt && <Badge tone="slate">email unverified</Badge>}
                    </div>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap justify-end gap-1">
                      {!isAdminAcct && (
                        <ActionButton size="sm" variant={u.verifiedAt ? "ghost" : "secondary"} action={async () => { "use server"; return verifyUserAction(u.id, !u.verifiedAt); }}>
                          {u.verifiedAt ? "Unverify" : "Verify"}
                        </ActionButton>
                      )}
                      {u.id !== viewer.id && (!isAdminAcct || isSuper) && (
                        <ActionButton
                          size="sm"
                          variant={u.status === "ACTIVE" ? "danger-outline" : "outline"}
                          promptNote={u.status === "ACTIVE" ? "Reason for suspension:" : undefined}
                          action={async (reason?: string) => { "use server"; return setUserStatusAction(u.id, u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE", reason); }}
                        >
                          {u.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                        </ActionButton>
                      )}
                      {isSuper && isAdminAcct && u.id !== viewer.id && (
                        <ActionButton size="sm" variant="ghost" action={async () => { "use server"; return setAdminRoleAction(u.id, u.role === "ADMIN" ? "SUPER_ADMIN" : "ADMIN"); }} confirm="Change this administrator's permissions?">
                          {u.role === "ADMIN" ? "Make super admin" : "Make admin"}
                        </ActionButton>
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
      {data.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {data.page > 1 && (
            <Button asChild size="sm" variant="outline">
              <Link href={`${basePath}?${new URLSearchParams({ ...searchParams, page: String(data.page - 1) } as Record<string, string>)}`}>Previous</Link>
            </Button>
          )}
          <span className="text-navy-500">
            Page {data.page} of {data.pages}
          </span>
          {data.page < data.pages && (
            <Button asChild size="sm" variant="outline">
              <Link href={`${basePath}?${new URLSearchParams({ ...searchParams, page: String(data.page + 1) } as Record<string, string>)}`}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </>
  );
}
