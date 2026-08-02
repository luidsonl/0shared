interface ErrorTextProps {
  message: string;
}

export default function ErrorText({ message }: ErrorTextProps) {
  return <p className="error-text">{message}</p>;
}
