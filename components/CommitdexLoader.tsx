type Props = {
  label: string;
  detail: string;
};

/**
 * Shared route feedback. Keep this server-renderable so loading.tsx can show
 * it before any client bundle has hydrated.
 */
export function CommitdexLoader({ label, detail }: Props) {
  return (
    <section className="cdx-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="cdx-loader__head">
        <span className="cdx-loader__mark" aria-hidden="true">
          CDX
        </span>
        <span className="cdx-loader__system">COMMITDEX // ROUTER</span>
        <span className="cdx-loader__led" aria-label="Loading" />
      </div>
      <div className="cdx-loader__rail" aria-hidden="true">
        <span className="cdx-loader__rail-fill" />
      </div>
      <p className="cdx-loader__label">{label}</p>
      <p className="cdx-loader__detail">{detail}</p>
    </section>
  );
}
