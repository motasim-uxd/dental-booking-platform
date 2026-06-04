import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dental Booking Platform",
  description: "Multi-tenant dental practice scheduling — web booking, voice, and PMS integration.",
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
