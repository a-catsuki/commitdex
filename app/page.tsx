import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { TypeSheet } from "@/components/TypeSheet";
import { Workbench } from "@/components/Workbench";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <Workbench />
        <TypeSheet />
      </main>
      <SiteFooter />
    </>
  );
}
