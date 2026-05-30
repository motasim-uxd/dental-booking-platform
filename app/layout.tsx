import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Smile Squad — Oryx scheduling",
  description: "Online scheduling for Smile Squad Pediatric Dentistry.",
};

/** Minimal root layout. /book does not load Tailwind (see app/(site)/layout.tsx). */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
