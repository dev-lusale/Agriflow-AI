import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  return (
    <div>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-navy-500">Free for farmers, buyers, suppliers and transporters.</p>
      <RegisterForm defaultRole={["FARMER", "BUYER", "SUPPLIER", "TRANSPORTER"].includes(role ?? "") ? role! : "FARMER"} />
      <p className="mt-6 text-center text-sm text-navy-600">
        Already registered?{" "}
        <Link href="/auth/login" className="font-semibold text-forest-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
