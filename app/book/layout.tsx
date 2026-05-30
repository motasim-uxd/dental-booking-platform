import "./booking.css";

/** Avoid stale HTML for the preview form behind CDNs / ALB. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Book an appointment | Smile Squad Pediatric Dentistry",
  description: "Schedule a pediatric dental visit online with Smile Squad.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const bookCriticalCss = `
.ss-book-root{min-height:100dvh;background:#fff}
.ss-ssr-fallback{min-height:100dvh;background:#fff;color:#0f2840}
.ss-book-root.ss-wizard-ready .ss-ssr-fallback{display:none}
`;

/** If React never paints the wizard, show a plain-HTML hint (no dependency on app bundles). */
const bookLoadGuardScript = `
(function () {
  var DEADLINE_MS = 28000;
  function check() {
    if (document.querySelector('[data-web-book="v3-wizard"]') || document.querySelector('.ss-preview-gate')) return;
    var box = document.querySelector('.ss-ssr-fallback');
    if (!box || document.getElementById('ss-js-failed')) return;
    var p = document.createElement('p');
    p.id = 'ss-js-failed';
    p.style.cssText = 'margin:1rem 0 0;padding:0.75rem;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:0.85rem;line-height:1.5';
    p.innerHTML = 'The scheduling form did not start. <button type="button" style="margin-left:0.35rem;padding:0.35rem 0.75rem;border:none;border-radius:6px;background:#1a3d5c;color:#fff;font-weight:600;cursor:pointer">Reload</button> or call +1 (717) 884-8807.';
    p.querySelector('button').onclick = function () { location.reload(); };
    box.appendChild(p);
  }
  if (document.readyState === 'complete') setTimeout(check, DEADLINE_MS);
  else window.addEventListener('load', function () { setTimeout(check, DEADLINE_MS); });
})();
`;

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="ss-book-root"
      suppressHydrationWarning
      style={{ minHeight: "100dvh", background: "#fff" }}
    >
      <style dangerouslySetInnerHTML={{ __html: bookCriticalCss }} />
      <script dangerouslySetInnerHTML={{ __html: bookLoadGuardScript }} />
      {children}
    </div>
  );
}