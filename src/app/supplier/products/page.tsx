import type { Metadata } from "next";
import { Package, Pencil, Plus } from "lucide-react";
import { Badge, Card, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { EmptyState, PageHeader, StatusBadge } from "@/components/layout/page";
import { FormDialog } from "@/components/forms/form-dialog";
import { ProductForm } from "@/components/suppliers/product-form";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatZMW } from "@/lib/money";
import { UNIT_LABEL } from "@/lib/labels";
import { formatNumber } from "@/lib/utils";
import { listMyProducts } from "@/server/suppliers/service";

export const metadata: Metadata = { title: "Products" };

export default async function SupplierProductsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const sp = await searchParams;
  const user = await requirePageRole("SUPPLIER");
  const [products, categories] = await Promise.all([listMyProducts({ id: user.id, role: user.role }), prisma.productCategory.findMany({ where: { isActive: true, kind: "INPUT" }, orderBy: { name: "asc" }, select: { id: true, name: true, requiresSafetyInfo: true } })]);
  return (
    <>
      <PageHeader
        title="Products"
        description="Seed, fertilizer, crop protection, equipment and tools you sell. Stock is linked to Inventory."
        actions={
          <FormDialog trigger={<><Plus /> Add product</>} title="Add a product" wide defaultOpen={sp.new === "1"}>
            <ProductForm categories={categories} />
          </FormDialog>
        }
      />
      {products.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" description="Add your first product so farmers can order it." />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>Product</TH>
                <TH>Category</TH>
                <TH>Price</TH>
                <TH>Stock</TH>
                <TH>Orders</TH>
                <TH>Status</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {products.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <p className="font-medium text-navy-900">{p.name}</p>
                    <p className="text-xs text-navy-500">{p.brand ?? "—"}</p>
                  </TD>
                  <TD>
                    {p.category.name}
                    {p.category.requiresSafetyInfo && (
                      <Badge tone={p.verification === "VERIFIED" ? "green" : "amber"} className="ml-1.5">
                        {p.verification === "VERIFIED" ? "Reg. verified" : "Reg. unverified"}
                      </Badge>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {formatZMW(p.price)} <span className="text-xs text-navy-500">/ {UNIT_LABEL[p.unit]}</span>
                  </TD>
                  <TD className={p.inventoryItem.quantity.lte(p.inventoryItem.minStockLevel) ? "font-semibold text-harvest-700" : ""}>{formatNumber(p.inventoryItem.quantity.toString())}</TD>
                  <TD>{p._count.orderItems}</TD>
                  <TD>
                    <StatusBadge status={p.moderationStatus === "REMOVED" ? "REMOVED" : p.isActive ? "ACTIVE" : "INACTIVE"} />
                  </TD>
                  <TD>
                    <FormDialog trigger={<Pencil />} title={`Edit ${p.name}`} size="icon-sm" variant="ghost" wide>
                      <ProductForm
                        categories={categories}
                        product={{ id: p.id, categoryId: p.categoryId, name: p.name, brand: p.brand, description: p.description, unit: p.unit, price: p.price.toString(), stock: p.inventoryItem.quantity.toString(), minStockLevel: p.inventoryItem.minStockLevel.toString(), registrationNumber: p.registrationNumber, safetyInfo: p.safetyInfo, isActive: p.isActive }}
                      />
                    </FormDialog>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
