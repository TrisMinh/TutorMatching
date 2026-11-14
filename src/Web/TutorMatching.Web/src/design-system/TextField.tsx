import { useId, useState, type InputHTMLAttributes } from 'react';
import './primitives.css';
import { Select } from './Select';

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
  const selectOptions: Record<string,string[]> = {
    'School level':['Primary','Grade 6–9','Grade 10','Grade 11','Grade 12','University','Adult'],
    'Timezone':['Asia/Ho_Chi_Minh','Asia/Bangkok','Asia/Singapore','Asia/Tokyo','Europe/London','America/New_York'],
    'Preferred language':['Vietnamese','English'],
    'Languages':['Vietnamese','English','Vietnamese, English'],
    'Repeat':['Every week','Every two weeks','Does not repeat'],
  };
  const choices=selectOptions[label];
  const effectiveType = isPassword && passwordVisible ? 'text' : type;

  return (
    <div className={`tm-field ${error ? 'tm-field--error' : ''} ${className}`.trim()}>
      <label className="tm-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="tm-field__control">
        {choices ? <Select className="tm-field__input" id={inputId} value={props.value} defaultValue={props.defaultValue} disabled={props.disabled} onChange={event=>props.onChange?.(event as unknown as React.ChangeEvent<HTMLInputElement>)}>{choices.map(choice=><option key={choice} value={choice}>{choice}</option>)}</Select> : <input
          aria-describedby={error || hint ? messageId : undefined}
          aria-invalid={error ? 'true' : undefined}
          className="tm-field__input"
          id={inputId}
          type={effectiveType}
          {...props}
        />}
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
