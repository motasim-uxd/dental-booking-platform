/** Hide the server HTML shell only after real wizard UI is in the DOM. */
export function markBookWizardShellReady(): void {
  const root = document.querySelector(".ss-book-root");
  if (!root) return;

  const painted =
    document.querySelector('[data-web-book="v3-wizard"]') ??
    document.querySelector(".ss-preview-gate");
  if (!painted) return;

  root.classList.add("ss-wizard-ready");
}

export function scheduleMarkBookWizardShellReady(): void {
  markBookWizardShellReady();
  requestAnimationFrame(() => requestAnimationFrame(markBookWizardShellReady));
}
