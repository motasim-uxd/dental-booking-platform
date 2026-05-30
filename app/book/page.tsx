import BookStaticShell from "./components/BookStaticShell";
import BookingWizardClient from "./components/BookingWizardClient";

type Props = {
  searchParams: Promise<{ code?: string | string[] }>;
};

export default async function BookPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = sp?.code;
  const initialPreviewCode = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  return (
    <>
      <noscript>
        <p style={{ padding: "1.25rem", fontFamily: "system-ui, sans-serif" }}>
          JavaScript is required for online scheduling. Call us at +1 (717) 884-8807.
        </p>
      </noscript>
      <BookStaticShell initialPreviewCode={initialPreviewCode} />
      <BookingWizardClient initialPreviewCode={initialPreviewCode} />
    </>
  );
}
