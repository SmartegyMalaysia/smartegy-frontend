import { forwardRef, type CSSProperties, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

type ControlSizing = { controlHeight?: CSSProperties["height"] };

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & ControlSizing>(function TextInput({ controlHeight = 38, style, ...props }, ref) {
  return <input ref={ref} style={{ ...style, height: controlHeight, minHeight: controlHeight }} {...props} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & ControlSizing>(function TextArea({ controlHeight = 38, style, ...props }, ref) {
  return <textarea ref={ref} style={{ ...style, height: controlHeight, minHeight: controlHeight }} {...props} />;
});
