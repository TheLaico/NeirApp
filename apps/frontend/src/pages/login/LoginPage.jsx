import { useState } from 'react';
import AuthScreen from '../../components/auth/AuthScreen.jsx';
import Field from '../../components/auth/Field.jsx';
import SocialButtons from '../../components/auth/SocialButtons.jsx';
import SubmitButton from '../../components/auth/SubmitButton.jsx';
import { login } from '../../services/auth.js';

/** Página "Iniciar sesión". */
export default function LoginPage({ onGoRegister, onSuccess }) {
  const [values, setValues] = useState({ identifier: '', password: '' });
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
    const next = {};
    if (!values.identifier.trim()) next.identifier = 'Ingresa tu correo o usuario.';
    if (!values.password) next.password = 'Ingresa tu contraseña.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      onSuccess(await login(values));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      variant="login"
      title="Iniciar sesión"
      subtitle={
        <>
          Ingresa a tu cuenta para disfrutar
          <br />
          de todos los servicios de NeirAPP.
        </>
      }
    >
      <form onSubmit={onSubmit} className="form" noValidate>
        <Field
          icon="user"
          placeholder="Correo electrónico o usuario"
          autoComplete="username"
          value={values.identifier}
          onChange={set('identifier')}
          error={errors.identifier}
        />
        <Field
          icon="lock"
          placeholder="Contraseña"
          password
          autoComplete="current-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
        />
        <a href="#" className="forgot" onClick={(e) => e.preventDefault()}>
          ¿Olvidaste tu contraseña?
        </a>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <SubmitButton loading={loading} loadingText="Ingresando…">
          Iniciar sesión
        </SubmitButton>
      </form>

      <SocialButtons />

      <p className="switch">
        ¿No tienes una cuenta?{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onGoRegister();
          }}
        >
          Crear cuenta
        </a>
      </p>
    </AuthScreen>
  );
}
