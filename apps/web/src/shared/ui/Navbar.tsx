import { LogOut, ShoppingCart, Store, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useLogout } from "../../features/auth/hooks";
import { useAuthStore } from "../../features/auth/store";
import { cartTotalItems, useCartStore } from "../../features/cart/store";
import { Logo } from "./Logo";

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const cartGroupsState = useCartStore((s) => s.groups);
  const cartItems = useMemo(() => cartTotalItems(cartGroupsState), [cartGroupsState]);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const firstName = user?.full_name.split(" ")[0] ?? "";

  return (
    <header className="sticky top-0 z-20 bg-brand-deep text-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link to="/">
          <Logo tone="light" />
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            to="/mi-tienda"
            className="hidden items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-white/10 sm:flex"
          >
            <Store size={18} aria-hidden="true" />
            Mi tienda
          </Link>

          <Link
            to="/carrito"
            aria-label="Carrito"
            className="relative grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10"
          >
            <ShoppingCart size={20} aria-hidden="true" />
            {cartItems > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-terracotta text-[10px] font-semibold leading-none text-white">
                {cartItems > 9 ? "9+" : cartItems}
              </span>
            )}
          </Link>

          <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/10"
          >
            <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand-deep">
              <UserRound size={20} aria-hidden="true" />
            </span>
            <span className="text-sm">
              Bienvenido, <strong className="font-display font-semibold">{firstName}</strong>
            </span>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-card border border-line bg-white p-1.5 text-ink shadow-raised"
            >
              <div className="border-b border-line px-3 py-2.5">
                <p className="truncate text-sm font-medium">{user?.full_name}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => logout.mutate()}
                className="mt-1.5 flex w-full items-center gap-2.5 rounded-control px-3 py-2.5 text-sm hover:bg-brand-soft"
              >
                <LogOut size={16} aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </header>
  );
}
