import { forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

type ControlSizing = { controlHeight?: CSSProperties["height"] };
type FieldTitle = { title?: string; fieldClassName?: string };

export function FormField({ title, htmlFor, required = false, className = "", children }: { title: string; htmlFor?: string; required?: boolean; className?: string; children: ReactNode }) {
  return <div className={`case-field ${className}`}><label htmlFor={htmlFor}>{title}{required && <span className="required-mark"> *</span>}</label>{children}</div>;
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & ControlSizing & FieldTitle>(function TextInput({ controlHeight = 38, style, title, fieldClassName, ...props }, ref) {
  const input = <input ref={ref} style={{ ...style, height: controlHeight, minHeight: controlHeight }} {...props} />;
  return title ? <FormField title={title} htmlFor={props.id} required={props.required} className={fieldClassName}>{input}</FormField> : input;
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
