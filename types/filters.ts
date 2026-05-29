import type { MediaType } from "@/types/media";

export interface CatalogFilters {
  readonly query: string;
  readonly mediaType: MediaType | "all";
  readonly genre: string | null;
  readonly maturityRating: string | null;
}
