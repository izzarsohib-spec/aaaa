import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <main className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="grid w-full max-w-sm gap-6">
        <div>
          <p className="text-sm font-medium text-accent">Adzkia Collection</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Masuk ke pembukuan toko</h1>
          <p className="mt-1 text-sm text-muted">Gunakan akun yang dibuat oleh pemilik toko.</p>
        </div>
        <Card>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </Card>
      </div>
    </main>
  );
}
