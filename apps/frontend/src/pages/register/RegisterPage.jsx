import { useState } from 'react';
import AuthScreen from '../../components/auth/AuthScreen.jsx';
import Field from '../../components/auth/Field.jsx';
import SubmitButton from '../../components/auth/SubmitButton.jsx';
import { register } from '../../services/auth.js';
import { validateRegistration } from './validate.js';

/** Página "Crear cuenta". */
export default function RegisterPage({ onGoLogin, onSuccess }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
    setFormError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = validateRegistration(values);
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      onSuccess(await register(values));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const backButton = (
    <button type="button" className="back" aria-label="Volver" onClick={onGoLogin}>
      <svg viewBox="0 0 24 24" className="arrow" aria-hidden="true">
        <path d="M20 12H5M11 6l-6 6 6 6" />
      </svg>
    </button>
  );

  return (
    <AuthScreen
      variant="register"
      title="Crear cuenta"
      topSlot={backButton}
      subtitle={
        <>
          Únete a NeirAPP y sé parte de
          <br />
          una comunidad que impulsa a Neira.
        </>
      }
    >
      <form onSubmit={onSubmit} className="form compact" noValidate>
        <Field icon="user" placeholder="Nombre completo" autoComplete="name"
          value={values.name} onChange={set('name')} error={errors.name} />
        <Field icon="mail" type="email" placeholder="Correo electrónico" autoComplete="email"
          value={values.email} onChange={set('email')} error={errors.email} />
        <Field icon="phone" type="tel" placeholder="Número de celular" autoComplete="tel"
          value={values.phone} onChange={set('phone')} error={errors.phone} />
        <Field icon="lock" placeholder="Contraseña" password autoComplete="new-password"
          value={values.password} onChange={set('password')} error={errors.password} />
        <Field icon="lock" placeholder="Confirmar contraseña" password autoComplete="new-password"
          value={values.confirm} onChange={set('confirm')} error={errors.confirm} />
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <SubmitButton loading={loading} loadingText="Creando cuenta…">
          Crear cuenta
        </SubmitButton>
      </form>

      <p className="legal">
        Al registrarte, aceptas nuestros
        <br />
        <a href="#" onClick={(e) => e.preventDefault()}>Términos y Condiciones</a> y{' '}
        <a href="#" onClick={(e) => e.preventDefault()}>Política de Privacidad</a>.
      </p>
    </AuthScreen>
  );
}
