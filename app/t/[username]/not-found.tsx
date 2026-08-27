import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { TrainerScan } from "@/components/TrainerScan";

export default function TrainerNotFound() {
  return (
    <>
      <SiteNav />
      <main className="dossier">
        <h1 className="dossier__title">No poster on file</h1>
        <p className="wanted__lede">
          That username has not been scanned yet, or the profile was removed.
        </p>
        <p>
          <Link href="/wanted">Back to Most Wanted</Link>
        </p>
        <TrainerScan />
      </main>
      <SiteFooter />
    </>
  );
}
