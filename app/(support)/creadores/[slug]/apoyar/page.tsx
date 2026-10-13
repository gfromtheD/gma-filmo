import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCreatorBySlug } from "@/lib/supabase/queries";
import { CreatorSupportPage } from "@/components/features/creator/creator-support-page";

export const dynamic = "force-dynamic";
interface Props { params: { slug: string } }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const creator = await getCreatorBySlug(params.slug);
  return { title: creator ? `Apoya a ${creator.nombre} — GMA Filmo` : "Apoyar al creador — GMA Filmo", robots: { index: false, follow: true } };
}
export default async function SupportPage({ params }: Props) {
  const creator = await getCreatorBySlug(params.slug);
  if (!creator) notFound();
  return <CreatorSupportPage creator={creator} />;
}
