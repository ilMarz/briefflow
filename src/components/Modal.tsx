"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  wide,
  locked,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  wide?: boolean;
  /** While true the dialog cannot be dismissed (Esc, backdrop, close button). */
  locked?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        if (locked) e.preventDefault();
      }}
      onClick={(e) => {
        if (!locked && e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <>
          <div className="modal-head">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {!locked && (
              <button aria-label="Chiudi" onClick={onClose}>
                <X size={15} />
              </button>
            )}
          </div>
          <div className="modal-body">{children}</div>
        </>
      )}
    </dialog>
  );
}
