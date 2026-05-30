"use client";

import { useEffect, useState } from "react";
import BookingWizard from "./BookingWizard";

type Props = {
  initialPreviewCode?: string;
};

/**
 * Wait until after mount before rendering the wizard so server HTML (shell) matches
 * client hydration. Wizard is statically imported so we do not depend on a second
 * lazy chunk that can leave the page stuck on "Please wait…".
 */
export default function BookingWizardClient({ initialPreviewCode = "" }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <BookingWizard initialPreviewCode={initialPreviewCode} />;
}
