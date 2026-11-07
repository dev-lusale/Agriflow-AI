import {
  BarChart3,
  Bell,
  Bot,
  Boxes,
  Brain,
  CalendarDays,
  ClipboardList,
  CloudSun,
  FileText,
  Grid3x3,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Sprout,
  Store,
  Tags,
  Tractor,
  Truck,
  User,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: "notifications" | "messages" };
export type NavGroup = { title?: string; items: NavItem[] };

export const NAV: Record<Role, NavGroup[]> = {
  FARMER: [
    { items: [{ href: "/farmer/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      title: "Farm",
      items: [
        { href: "/farmer/farms", label: "Farms", icon: Tractor },
        { href: "/farmer/fields", label: "Fields", icon: Grid3x3 },
        { href: "/farmer/crops", label: "Crops", icon: Sprout },
        { href: "/farmer/activities", label: "Activities", icon: ListChecks },
        { href: "/farmer/calendar", label: "Calendar", icon: CalendarDays },
        { href: "/farmer/inventory", label: "Inventory", icon: Warehouse },
      ],
    },
    {
      title: "Intelligence",
      items: [
        { href: "/farmer/assistant", label: "AI Assistant", icon: Bot },
        { href: "/farmer/crop-health", label: "Crop Health", icon: HeartPulse },
        { href: "/farmer/weather", label: "Weather", icon: CloudSun },
        { href: "/farmer/reports", label: "Reports", icon: FileText },
      ],
    },
    {
      title: "Business",
      items: [
        { href: "/farmer/listings", label: "My listings", icon: Tags },
        { href: "/farmer/orders", label: "Orders", icon: ClipboardList },
        { href: "/farmer/marketplace", label: "Market & inputs", icon: Store },
        { href: "/farmer/deliveries", label: "Deliveries", icon: Truck },
        { href: "/farmer/finances", label: "Finances", icon: Wallet },
      ],
    },
    {
      items: [
        { href: "/messages", label: "Messages", icon: MessageSquare, badge: "messages" },
        { href: "/farmer/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
        { href: "/farmer/profile", label: "Profile", icon: User },
      ],
    },
  ],
  BUYER: [
    {
      items: [
        { href: "/buyer/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/buyer/marketplace", label: "Marketplace", icon: ShoppingBasket },
        { href: "/buyer/orders", label: "Orders", icon: ShoppingCart },
        { href: "/buyer/deliveries", label: "Deliveries", icon: Truck },
        { href: "/buyer/messages", label: "Messages", icon: MessageSquare, badge: "messages" },
        { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
        { href: "/buyer/profile", label: "Profile", icon: User },
      ],
    },
  ],
  SUPPLIER: [
    {
      items: [
        { href: "/supplier/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/supplier/products", label: "Products", icon: Package },
        { href: "/supplier/inventory", label: "Inventory", icon: Boxes },
        { href: "/supplier/orders", label: "Orders", icon: ClipboardList },
        { href: "/supplier/reports", label: "Sales reports", icon: BarChart3 },
        { href: "/messages", label: "Messages", icon: MessageSquare, badge: "messages" },
        { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
      ],
    },
  ],
  TRANSPORTER: [
    {
      items: [
        { href: "/transporter/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/transporter/requests", label: "Requests", icon: ClipboardList },
        { href: "/transporter/deliveries", label: "My deliveries", icon: Truck },
        { href: "/transporter/vehicles", label: "Vehicles", icon: Tractor },
        { href: "/messages", label: "Messages", icon: MessageSquare, badge: "messages" },
        { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
        { href: "/transporter/profile", label: "Profile", icon: User },
      ],
    },
  ],
  ADMIN: adminNav(),
  SUPER_ADMIN: adminNav(),
};

function adminNav(): NavGroup[] {
  return [
    { items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }] },
    {
      title: "People",
      items: [
        { href: "/admin/users", label: "User management", icon: Users },
        { href: "/admin/farmers", label: "Farmers", icon: Sprout },
        { href: "/admin/buyers", label: "Buyers", icon: ShoppingCart },
        { href: "/admin/suppliers", label: "Suppliers", icon: Package },
        { href: "/admin/transporters", label: "Transporters", icon: Truck },
      ],
    },
    {
      title: "Operations",
      items: [
        { href: "/admin/farms", label: "Farms & activities", icon: Tractor },
        { href: "/admin/crops", label: "Crops & regions", icon: Grid3x3 },
        { href: "/admin/marketplace", label: "Marketplace", icon: Store },
        { href: "/admin/orders", label: "Orders", icon: ClipboardList },
        { href: "/admin/deliveries", label: "Deliveries", icon: Truck },
        { href: "/admin/inventory", label: "Inventory", icon: Boxes },
        { href: "/admin/market-prices", label: "Market prices", icon: Tags },
      ],
    },
    {
      title: "Insight",
      items: [
        { href: "/admin/ai", label: "AI intelligence", icon: Brain },
        { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/admin/reports", label: "Reports", icon: FileText },
      ],
    },
    {
      title: "System",
      items: [
        { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
        { href: "/admin/settings", label: "Settings", icon: Settings },
        { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
      ],
    },
  ];
}

/** Bottom tab bar on phones (max 5). */
export const MOBILE_TABS: Record<Role, NavItem[]> = {
  FARMER: [
    { href: "/farmer/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/farmer/farms", label: "Farms", icon: Tractor },
    { href: "/farmer/assistant", label: "AI", icon: Bot },
    { href: "/farmer/orders", label: "Orders", icon: ClipboardList },
    { href: "/farmer/finances", label: "Money", icon: Wallet },
  ],
  BUYER: [
    { href: "/buyer/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/buyer/marketplace", label: "Market", icon: ShoppingBasket },
    { href: "/buyer/orders", label: "Orders", icon: ShoppingCart },
    { href: "/buyer/messages", label: "Messages", icon: MessageSquare },
    { href: "/buyer/deliveries", label: "Deliveries", icon: Truck },
  ],
  SUPPLIER: [
    { href: "/supplier/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/supplier/products", label: "Products", icon: Package },
    { href: "/supplier/inventory", label: "Stock", icon: Boxes },
    { href: "/supplier/orders", label: "Orders", icon: ClipboardList },
    { href: "/supplier/reports", label: "Sales", icon: BarChart3 },
  ],
  TRANSPORTER: [
    { href: "/transporter/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/transporter/requests", label: "Requests", icon: ClipboardList },
    { href: "/transporter/deliveries", label: "Deliveries", icon: Truck },
    { href: "/transporter/vehicles", label: "Vehicles", icon: Tractor },
    { href: "/notifications", label: "Alerts", icon: Bell },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/orders", label: "Orders", icon: ClipboardList },
    { href: "/admin/ai", label: "AI", icon: Brain },
    { href: "/admin/settings", label: "Settings", icon: ShieldCheck },
  ],
  SUPER_ADMIN: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/orders", label: "Orders", icon: ClipboardList },
    { href: "/admin/ai", label: "AI", icon: Brain },
    { href: "/admin/settings", label: "Settings", icon: ShieldCheck },
  ],
};
