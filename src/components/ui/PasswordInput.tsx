"use client";

import { useState } from "react";
import { Input } from "./Field";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-16" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-dim hover:text-ink"
        aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
      >
        {show ? "verbergen" : "zeigen"}
      </button>
    </div>
  );
}
