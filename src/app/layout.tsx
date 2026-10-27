import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Adzkia Collection", template: "%s | Adzkia Collection" },
  description: "Pembukuan dan inventaris toko seragam satpam Adzkia Collection",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-[100dvh]">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
