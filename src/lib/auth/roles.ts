import type { Role } from "@prisma/client";

/** Shared (client-safe) role helpers. */
export const ROLE_HOME: Record<Role, string> = {
  FARMER: "/farmer/dashboard",
  BUYER: "/buyer/dashboard",
  SUPPLIER: "/supplier/dashboard",
  TRANSPORTER: "/transporter/dashboard",
  ADMIN: "/admin",
  SUPER_ADMIN: "/admin",
  EXPERT: "/expert/dashboard",
  DISTRIBUTOR: "/supplier/dashboard",
};

export const ROLE_LABEL: Record<Role, string> = {
  FARMER: "Farmer",
  BUYER: "Buyer",
  SUPPLIER: "Input supplier",
  TRANSPORTER: "Transporter",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super administrator",
  EXPERT: "Agricultural expert",
  DISTRIBUTOR: "Distributor",
};

export const SELF_REGISTER_ROLES = ["FARMER", "BUYER", "SUPPLIER", "TRANSPORTER", "EXPERT", "DISTRIBUTOR"] as const;

/** Roles that sell inputs (products, stock, input orders). */
export const isSellerRole = (r: Role) => r === "SUPPLIER" || r === "DISTRIBUTOR";
/** Roles that carry deliveries. */
export const isCarrierRole = (r: Role) => r === "TRANSPORTER" || r === "DISTRIBUTOR";
export const SELLER_ROLES: Role[] = ["SUPPLIER", "DISTRIBUTOR"];
export const CARRIER_ROLES: Role[] = ["TRANSPORTER", "DISTRIBUTOR"];

export const isAdminRole = (r: Role) => r === "ADMIN" || r === "SUPER_ADMIN";

/** Which URL prefixes each role may open. Enforced server-side in layouts + actions; proxy only does a cookie pre-check. */
export const ROLE_AREAS: Record<string, Role[]> = {
  "/farmer": ["FARMER"],
  "/buyer": ["BUYER"],
  "/supplier": ["SUPPLIER", "DISTRIBUTOR"],
  "/transporter": ["TRANSPORTER", "DISTRIBUTOR"],
  "/expert": ["EXPERT"],
  "/admin": ["ADMIN", "SUPER_ADMIN"],
};

export function canAccessPath(role: Role, pathname: string) {
  const area = Object.keys(ROLE_AREAS).find((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!area) return true;
  return ROLE_AREAS[area]!.includes(role);
}
