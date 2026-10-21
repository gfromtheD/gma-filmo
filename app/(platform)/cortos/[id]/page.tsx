import type { Metadata } from "next";
import { WorkDetailPage, workMetadata } from "@/components/features/detail/work-detail-page";

export const revalidate = 3600;

interface Props {
  params: { id: string };
  searchParams: { valorar?: string };
}

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return workMetadata(params.id);
}

export default function CortoDetailPage({ params, searchParams }: Props) {
  return <WorkDetailPage id={params.id} section="cortos" rate={searchParams.valorar === "1"} />;
}
