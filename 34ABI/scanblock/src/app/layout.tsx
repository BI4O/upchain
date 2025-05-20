import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WagmiProvider } from "@/components/WagmiProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "区块链事件查询",
  description: "查询区块链上的 Transfer 事件",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className={inter.className}>
        <WagmiProvider>{children}</WagmiProvider>
      </body>
    </html>
  );
}
