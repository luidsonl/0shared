import type { InputHTMLAttributes } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export default function TextInput(props: TextInputProps) {
  return <input {...props} />;
}
