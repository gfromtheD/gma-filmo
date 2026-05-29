import { notFound } from "next/navigation";
import { SERIES, EPISODES_BY_SERIES } from "@/lib/data/catalog";
import { SeriesDetail } from "@/components/features/detail/series-detail";

interface Props {
  params: { id: string };
}

export function generateStaticParams() {
  return SERIES.map((s) => ({ id: s.id }));
}

export default function SeriesDetailPage({ params }: Props) {
  const series = SERIES.find((s) => s.id === params.id);
  if (!series) notFound();

  const episodes = EPISODES_BY_SERIES[params.id] ?? [];

  const related = SERIES.filter(
    (s) =>
      s.id !== params.id &&
      s.categories.some((c) => series.categories.includes(c))
  ).slice(0, 4);

  return <SeriesDetail series={series} episodes={episodes} related={related} />;
}
