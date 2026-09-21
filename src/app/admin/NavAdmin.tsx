"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { href: "/admin", label: "Kotak masuk" },
  { href: "/admin/listing", label: "Barang" },
  { href: "/admin/riwayat", label: "Riwayat" },
  { href: "/admin/pengaturan", label: "Pengaturan" },
];

export default function NavAdmin() {
  const path = usePathname();

  return (
    <nav className="mx-auto w-full max-w-3xl overflow-x-auto px-4 pb-1">
      <ul className="flex gap-1">
        {MENU.map((item) => {
          const aktif =
            item.href === "/admin" ? path === "/admin" : path.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={aktif ? "page" : undefined}
                className={`inline-block min-h-11 rounded-t-[10px] px-4 py-2.5 font-semibold ${
                  aktif ? "bg-kertas text-daun-tua" : "text-putih/80"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
