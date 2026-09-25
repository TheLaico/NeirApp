import { useState } from 'react';

const icons = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3M12 15v2" />
    </>
  ),
};

const Eye = ({ off }) => (
  <svg viewBox="0 0 24 24" className="ico" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 20L20 4" />}
  </svg>
);

export default function Field({ icon, type = 'text', placeholder, password, error, ...rest }) {
  const [show, setShow] = useState(false);

  return (
    <div className="field-wrap">
      <label className={`field${error ? ' invalid' : ''}`}>
        <svg viewBox="0 0 24 24" className="ico lead" aria-hidden="true">
          {icons[icon]}
        </svg>
        <input
          type={password ? (show ? 'text' : 'password') : type}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={error ? 'true' : undefined}
          {...rest}
        />
        {password && (
          <button
            type="button"
            className="eye"
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setShow((s) => !s)}
          >
            <Eye off={!show} />
          </button>
        )}
      </label>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
