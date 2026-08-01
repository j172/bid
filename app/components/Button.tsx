import type { ButtonHTMLAttributes } from "react";

export default function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md bg-interactive-primary px-4 py-2 font-medium text-white transition hover:bg-interactive-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive-primary disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}
