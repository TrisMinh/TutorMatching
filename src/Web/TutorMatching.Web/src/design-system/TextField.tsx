import { useId, useState, type InputHTMLAttributes } from 'react';
import './primitives.css';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextField({
  error,
  hint,
  id,
  label,
  type = 'text',
  className = '',
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const isPassword = type === 'password';
  const [passwordVisible, setPasswordVisible] = useState(false);
  const effectiveType = isPassword && passwordVisible ? 'text' : type;

  return (
    <div className={`tm-field ${error ? 'tm-field--error' : ''} ${className}`.trim()}>
      <label className="tm-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="tm-field__control">
        <input
          aria-describedby={error || hint ? messageId : undefined}
          aria-invalid={error ? 'true' : undefined}
          className="tm-field__input"
          id={inputId}
          type={effectiveType}
          {...props}
        />
        {isPassword ? (
          <button
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            className="tm-field__password-toggle"
            onClick={() => setPasswordVisible((visible) => !visible)}
            type="button"
          >
            {passwordVisible ? 'Hide' : 'Show'}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="tm-field__message tm-field__message--error" id={messageId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="tm-field__message" id={messageId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
