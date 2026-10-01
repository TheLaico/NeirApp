export const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" className="arrow" aria-hidden="true">
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

/** Botón principal de los formularios de acceso. */
export default function SubmitButton({ loading, loadingText, children }) {
  return (
    <button type="submit" className="btn" disabled={loading}>
      {loading ? (
        loadingText
      ) : (
        <>
          {children} <ArrowIcon />
        </>
      )}
    </button>
  );
}
