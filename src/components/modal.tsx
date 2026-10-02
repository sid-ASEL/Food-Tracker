"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export function Modal({ title, children, onClose, busy = false, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={`modal ${wide ? "wide" : ""}`} aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}
