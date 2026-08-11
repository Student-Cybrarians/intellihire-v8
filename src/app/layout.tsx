import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IntelliHire — AI-Based Placement Trainer",
  description: "Train smart. Perform better. Get placed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
