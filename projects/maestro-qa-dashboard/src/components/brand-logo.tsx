export function BrandLogo({ className = "brand-logo" }: { className?: string }) {
  return (
    <span className="brand-lockup">
      <img src="/brand/logo-horizontal.png" alt="Maestro QA" className={`${className} logo-on-light`} />
      <img src="/brand/logo-horizontal-on-dark.png" alt="" className={`${className} logo-on-dark`} aria-hidden />
    </span>
  );
}
