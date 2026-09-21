import Link from "next/link";
import FormListing from "../FormListing";

export default function ListingBaru() {
  return (
    <>
      <nav className="mb-4">
        <Link href="/admin/listing" className="text-base text-daun underline">
          ← Kembali ke daftar barang
        </Link>
      </nav>
      <h1 className="mb-5 text-3xl font-extrabold text-daun-tua">
        Pasang barang
      </h1>
      <FormListing />
    </>
  );
}
