"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/* ----------------------------------------------------------------- Button */
type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-surface text-foreground border border-border hover:bg-zinc-100",
  danger: "bg-danger text-white hover:bg-red-800",
  ghost: "hover:bg-zinc-100",
};

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
    >
      {loading ? "Memproses..." : children}
    </button>
  );
}

/* ------------------------------------------------------------ Field/Input */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (p: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const msgId = id + "-msg";
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": error || hint ? msgId : undefined })}
      {(error || hint) && (
        <p id={msgId} className={cx("text-sm", error ? "text-danger" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm aria-[invalid=true]:border-danger disabled:bg-zinc-100";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, props.className)} />;
}

/* ------------------------------------------------------------ Card/Badge */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-lg border border-border bg-surface p-5", className)}>{children}</section>;
}

const badgeTone = {
  neutral: "bg-zinc-100 text-zinc-700",
  good: "bg-accent-soft text-blue-900",
  bad: "bg-danger-soft text-red-900",
  warn: "bg-warn-soft text-warn",
} as const;
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTone; children: ReactNode }) {
  return <span className={cx("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTone[tone])}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-zinc-200", className)} aria-hidden />;
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm text-red-900">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Table */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
export const Th = ({ children, right }: { children?: ReactNode; right?: boolean }) => (
  <th scope="col" className={cx("border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted", right && "text-right")}>
    {children}
  </th>
);
export const Td = ({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) => (
  <td className={cx("border-b border-border px-4 py-3 align-middle last:border-b-0", right && "text-right", className)}>{children}</td>
);

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <TableWrap>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <Td key={c}>
                <Skeleton className="h-4 w-full" />
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

export function Empty({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="max-w-[40ch] text-sm text-muted">{hint}</p>
      {action}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <nav aria-label="Paginasi" className="flex items-center justify-between gap-3 pt-3 text-sm">
      <span className="text-muted">{total} data</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Sebelumnya
        </Button>
        <span aria-live="polite">
          {page} / {totalPages}
        </span>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Berikutnya
        </Button>
      </div>
    </nav>
  );
}

/* ----------------------------------------------------------------- Dialog */
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-foreground backdrop:bg-black/40"
    >
      {open && (
        <div className="enter grid gap-4 p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <p className="text-sm text-muted">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Batal
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Toast */
interface ToastItem {
  id: number;
  text: string;
  tone: "ok" | "err";
}
const ToastCtx = createContext<(text: string, tone?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, text, tone }]);
    setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="no-print fixed bottom-4 right-4 z-50 grid w-[min(24rem,calc(100vw-2rem))] gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "err" ? "alert" : "status"}
            className={cx(
              "enter rounded-md border px-4 py-3 text-sm shadow-sm",
              t.tone === "err" ? "border-red-200 bg-danger-soft text-red-900" : "border-blue-200 bg-accent-soft text-blue-900",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
