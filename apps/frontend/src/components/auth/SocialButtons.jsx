/** Botones "o continúa con" Google y Apple (todavía sin acción). */
export default function SocialButtons() {
  return (
    <>
      <div className="divider">
        <span>o continúa con</span>
      </div>
      <div className="socials">
        <button type="button" className="social" aria-label="Continuar con Google">
          <svg viewBox="0 0 48 48" width="26" height="26">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.7-9.8 6.7-17.4z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.3-5.7c-2 1.4-4.6 2.3-8.7 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
        </button>
        <button type="button" className="social" aria-label="Continuar con Apple">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="#111">
            <path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.9c-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8 2.2-1.2 3.1-2.4c1-1.4 1.4-2.8 1.4-2.9-.1 0-2.8-1.1-2.8-4.2zM13.9 5.2c.7-.9 1.2-2.1 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" />
          </svg>
        </button>
      </div>
    </>
  );
}
