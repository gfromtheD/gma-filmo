import { Suspense } from "react";
import { CatalogScreen } from "@/components/features/catalog/catalog-screen";

export default function SeriesPage() {
  return (
    <Suspense>
      <CatalogScreen items={[]} heading="Series" />
    </Suspense>
  );
}
