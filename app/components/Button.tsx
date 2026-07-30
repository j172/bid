import type { ButtonHTMLAttributes } from "react";

export default function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md bg-gold px-4 py-2 font-medium text-white transition hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}
