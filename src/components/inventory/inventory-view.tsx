import { AlertTriangle, ArrowDownUp, Boxes, Download, Plus, Trash2 } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { EmptyState, PageHeader, StatCard } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/forms/form-dialog";
import { ActionButton } from "@/components/forms/action-form";
import { InventoryItemForm, StockMoveForm } from "@/components/inventory/forms";
import type { Actor } from "@/lib/action";
import { formatZMW } from "@/lib/money";
import { INVENTORY_CATEGORY_LABEL } from "@/lib/labels";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { listInventory, movementHistory } from "@/server/inventory/service";
import { deleteInventoryItemAction } from "@/server/actions/ops";
import { prisma } from "@/lib/db";

export async function InventoryView({ actor, title, description }: { actor: Actor; title: string; description: string }) {
  const [{ items, valuation, low, expiringSoon }, movements, farms] = await Promise.all([
    listInventory(actor),
    movementHistory(actor),
    actor.role === "FARMER" ? prisma.farm.findMany({ where: { ownerId: actor.id }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/api/export/inventory">
                <Download /> Export CSV
              </a>
            </Button>
            {actor.role === "FARMER" && (
              <FormDialog trigger={<><Plus /> Add item</>} title="Add inventory item" wide>
                <InventoryItemForm farms={farms} />
              </FormDialog>
            )}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Items" value={items.length} icon={Boxes} />
        <StatCard label="Inventory value" value={formatZMW(valuation, { compact: true })} hint="At recorded unit cost" icon={ArrowDownUp} tone="sky" />
        <StatCard label="Low stock" value={low.length} hint="At or below minimum" icon={AlertTriangle} tone={low.length ? "amber" : "forest"} />
        <StatCard label="Expiring ≤ 30 days" value={expiringSoon.length} icon={AlertTriangle} tone={expiringSoon.length ? "amber" : "navy"} />
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Boxes} title="No inventory yet" description="Track seed, fertilizer, chemicals, tools and harvested produce." />
      ) : (
        <Card className="mb-6">
          <Table>
            <THead>
              <tr>
                <TH>Item</TH>
                <TH>Category</TH>
                <TH>In stock</TH>
                <TH>Minimum</TH>
                <TH>Unit cost</TH>
                <TH>Value</TH>
                <TH>Storage</TH>
                <TH>Expiry</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {items.map((i) => {
                const isLow = i.minStockLevel.gt(0) && i.quantity.lte(i.minStockLevel);
                return (
                  <TR key={i.id}>
                    <TD>
                      <p className="font-medium text-navy-900">{i.name}</p>
                      {i.supplierProduct && <p className="text-xs text-navy-500">Linked to product listing</p>}
                      {i.farm && <p className="text-xs text-navy-500">{i.farm.name}</p>}
                    </TD>
                    <TD>{INVENTORY_CATEGORY_LABEL[i.category]}</TD>
                    <TD className="whitespace-nowrap">
                      <span className={isLow ? "font-semibold text-harvest-700" : "font-semibold"}>{formatNumber(i.quantity.toString())}</span> {i.unit}
                      {isLow && <Badge tone="amber" className="ml-1.5">Low</Badge>}
                      {i.quantity.lt(0) && <Badge tone="red" className="ml-1.5">Negative (adjusted)</Badge>}
                    </TD>
                    <TD>{formatNumber(i.minStockLevel.toString())}</TD>
                    <TD>{i.unitCost ? formatZMW(i.unitCost) : "—"}</TD>
                    <TD>{i.unitCost ? formatZMW(i.quantity.times(i.unitCost)) : "—"}</TD>
                    <TD>{i.storageLocation ?? "—"}</TD>
                    <TD className="whitespace-nowrap">{formatDate(i.expiryDate)}</TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <FormDialog trigger={<><ArrowDownUp /> Stock</>} title={`Update stock: ${i.name}`} size="sm" variant="secondary" description={`Current: ${i.quantity.toString()} ${i.unit}`}>
                          <StockMoveForm itemId={i.id} unit={i.unit} />
                        </FormDialog>
                        {!i.supplierProduct && (
                          <ActionButton size="icon-sm" variant="ghost" aria-label="Delete" confirm={`Delete ${i.name} and its history?`} action={async () => { "use server"; return deleteInventoryItemAction(i.id); }}>
                            <Trash2 />
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
      )}
      <Card>
        <CardHeader>
          <CardTitle>Stock movement history</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Item</TH>
                <TH>Type</TH>
                <TH>Change</TH>
                <TH>Balance</TH>
                <TH>Reason</TH>
              </tr>
            </THead>
            <TBody>
              {movements.slice(0, 40).map((m) => (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap text-xs">{formatDateTime(m.createdAt)}</TD>
                  <TD>{m.item.name}</TD>
                  <TD>
                    <Badge tone={m.quantityChange.gt(0) ? "green" : m.type === "ADJUSTMENT" ? "amber" : "slate"}>{m.type.toLowerCase()}</Badge>
                  </TD>
                  <TD className={m.quantityChange.gt(0) ? "font-medium text-forest-700" : "font-medium text-navy-700"}>
                    {m.quantityChange.gt(0) ? "+" : ""}
                    {formatNumber(m.quantityChange.toString())}
                  </TD>
                  <TD>{formatNumber(m.balanceAfter.toString())}</TD>
                  <TD className="text-xs">{m.reason ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
