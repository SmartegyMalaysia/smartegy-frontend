"use client";

import { forwardRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Icon } from "./icons";

type ControlSizing = { controlHeight?: CSSProperties["height"] };
type FieldTitle = { title?: string; fieldClassName?: string };
type InputPrefix = { prefix?: ReactNode };

export function FormField({ title, htmlFor, required = false, className = "", children }: { title: string; htmlFor?: string; required?: boolean; className?: string; children: ReactNode }) {
  return <div className={`case-field ${className}`}><label htmlFor={htmlFor}>{title}{required && <span className="required-mark"> *</span>}</label>{children}</div>;
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & ControlSizing & FieldTitle & InputPrefix>(function TextInput({ controlHeight = 38, style, title, fieldClassName, prefix, ...props }, ref) {
  const inputElement = <input ref={ref} style={{ ...style, height: controlHeight, minHeight: controlHeight }} {...props} />;
  const input = prefix ? <div className="text-input-with-prefix"><span className="text-input-prefix" aria-hidden="true">{prefix}</span>{inputElement}</div> : inputElement;
  return title ? <FormField title={title} htmlFor={props.id} required={props.required} className={fieldClassName}>{input}</FormField> : input;
});

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  error?: string | string[];
  fieldClassName?: string;
  labelAside?: ReactNode;
  showRequiredIndicator?: boolean;
  variant?: "auth" | "registration";
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField({
  id,
  label,
  error,
  fieldClassName = "",
  labelAside,
  showRequiredIndicator = false,
  variant = "auth",
  required,
  className = "",
  autoComplete,
  "aria-describedby": ariaDescribedBy,
  ...props
}, ref) {
  const [visible, setVisible] = useState(false);
  const errorMessage = Array.isArray(error) ? error[0] : error;
  const errorId = id && errorMessage ? `${id}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;
  const fieldBaseClass = variant === "registration" ? "registration-field" : "form-field";
  const errorClass = variant === "registration" ? "registration-field-error" : "password-field-error";
  const labelNode = <label htmlFor={id}>{label}{required && showRequiredIndicator && <span className="required-mark" aria-hidden="true">*</span>}</label>;

  return <div className={`${fieldBaseClass} password-field ${errorMessage ? errorClass : ""} ${fieldClassName}`.trim()}>
    {labelAside ? <div className="field-label-row">{labelNode}{labelAside}</div> : labelNode}
    <div className="password-input">
      <TextInput
        {...props}
        ref={ref}
        id={id}
        className={className}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={describedBy}
      />
      <button
        className="password-toggle"
        type="button"
        aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        <Icon name={visible ? "eye-off" : "eye"} size={18} />
      </button>
    </div>
    {errorMessage && errorId && <p id={errorId} className="field-error" role="alert">{errorMessage}</p>}
  </div>;
});

export const MoneyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & ControlSizing & FieldTitle>(function MoneyInput({ className = "", title, fieldClassName, ...props }, ref) {
  const input = <div className="money-input"><span className="money-input-prefix" aria-hidden="true">RM</span><TextInput ref={ref} className={className} {...props} /></div>;
  return title ? <FormField title={title} htmlFor={props.id} required={props.required} className={fieldClassName}>{input}</FormField> : input;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & ControlSizing & FieldTitle>(function TextArea({ controlHeight = 38, style, title, fieldClassName, ...props }, ref) {
  const textarea = <textarea ref={ref} style={{ ...style, height: controlHeight, minHeight: controlHeight }} {...props} />;
  return title ? <FormField title={title} htmlFor={props.id} required={props.required} className={fieldClassName}>{textarea}</FormField> : textarea;
});

export function ReadOnlyField({ id, title, label, value, multiline = false }: { id: string; title?: string; label?: string; value: string; multiline?: boolean }) {
  return <FormField title={title ?? label ?? ""} htmlFor={id} className="case-readonly-field">{multiline ? <TextArea id={id} value={value} readOnly rows={3} controlHeight={76} /> : <TextInput id={id} value={value} readOnly />}</FormField>;
}
