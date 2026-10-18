export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type EngineTable<Row extends Record<string, unknown>> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}
type EngineJsonRow = Json

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      gma_upload_drafts: EngineTable<{ id: string; owner_id: string; purpose: string; state: string; metadata: EngineJsonRow; revision: number; title_id: number | null; created_at: string; updated_at: string }>
      gma_media_assets: EngineTable<{ id: string; owner_id: string; role: string; provider: string; provider_ref: string | null; state: string; expected_input_bytes: number; received_bytes: number | null; provider_reported_size: number | null; duration_seconds: number | null; metadata: EngineJsonRow; delivery_path: string | null; original_bytes: number | null; processed_bytes: number | null; auxiliary_bytes: number | null; revision: number; processing_generation: number; error_code: string | null; error_retryable: boolean; verified_at: string | null; created_at: string; updated_at: string }>
      gma_upload_sessions: EngineTable<{ id: string; owner_id: string; draft_id: string; asset_id: string; role: string; slot: string; language: string | null; provider: string; provider_ref: string | null; provider_data: EngineJsonRow; object_key: string | null; multipart_upload_id: string | null; part_size: number; transfer_generation: number; expected_input_bytes: number; source_sha256: string; content_type: string; file_name: string; max_duration_seconds: number; state: string; expires_at: string; revision: number; quota_confirmed: boolean; quota_released: boolean; idempotency_key: string; request_hash: string; transfer_lease_owner: string | null; transfer_lease_until: string | null; transfer_fence: number; retry_count: number; last_error_code: string | null; created_at: string; updated_at: string }>
      gma_draft_media: EngineTable<{ draft_id: string; owner_id: string; asset_id: string; role: string; slot: string; language: string | null; position: number }>
      gma_title_media: EngineTable<{ title_id: number; asset_id: string; owner_id: string; role: string; slot: string; language: string | null; position: number }>
      gma_upload_jobs: EngineTable<{ id: string; session_id: string | null; kind: string; payload: EngineJsonRow; dedupe_key: string; state: string; attempts: number; run_after: string; lease_owner: string | null; lease_until: string | null; last_error: string | null; created_at: string; updated_at: string }>
      gma_upload_account_deletions: EngineTable<{ owner_id: string; state: string; created_at: string }>
      gma_media_provider_private: EngineTable<{ session_id: string; asset_id: string; provider: string; upload_id: string | null; private_state: EngineJsonRow; updated_at: string }>
      gma_media_command_results: EngineTable<{ owner_id: string; session_id: string | null; title_id: number | null; action: string; idempotency_key: string; request_hash: string; result: EngineJsonRow; created_at: string }>
      gma_media_upload_chunks: EngineTable<{ session_id: string; generation: number; start_byte: number; end_byte: number; sha256: string; storage_relative: string; writer_fence: number; upstream_confirmed: boolean }>
      gma_media_outputs: EngineTable<{ asset_id: string; relative: string; object_key: string; mime_type: string | null; size_bytes: number | null }>
      gma_media_gateway_grants: EngineTable<{ token_hash: string; asset_id: string; generation: number; owner_id: string | null; draft_id: string | null; title_slug: string | null; audience: string; expires_at: string; created_at: string }>
      /** Local-only fixture metadata; created by infrastructure/media-local/baseline.sql. */
      gma_media_local_fixture: EngineTable<{ id: boolean; project_id: string; inventory_seeded: boolean; inventory_bytes: number }>
      gma_title_media_versions: EngineTable<{ title_id: number; revision: number; owner_id: string; snapshot: EngineJsonRow; retained_until: string; created_at: string }>
      creator_profiles: {
        Row: {
          user_id: string
          creator_name: string
          bio: string | null
          status: string
          created_at: string
          studio_name: string | null
          location: string | null
          website_url: string | null
          role: string | null
          instagram_url: string | null
          vimeo_url: string | null
          avatar_url: string | null
          banner_url: string | null
          notify_ratings: boolean
          social_links: Json
        }
        Insert: {
          user_id: string
          creator_name: string
          bio?: string | null
          status?: string
          created_at?: string
          studio_name?: string | null
          location?: string | null
          website_url?: string | null
          role?: string | null
          instagram_url?: string | null
          vimeo_url?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          notify_ratings?: boolean
          social_links?: Json
        }
        Update: {
          user_id?: string
          creator_name?: string
          bio?: string | null
          status?: string
          created_at?: string
          studio_name?: string | null
          location?: string | null
          website_url?: string | null
          role?: string | null
          instagram_url?: string | null
          vimeo_url?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          notify_ratings?: boolean
          social_links?: Json
        }
        Relationships: []
      }
      creator_public_profiles: EngineTable<{ slug: string; user_id: string | null; nombre: string; foto_perfil: string | null; imagen_portada: string | null; nacionalidad: string | null; bio: string | null; redes_sociales: Json; donacion_paypal: string | null; donacion_patreon: string | null; donacion_bitcoin: string | null; titulos: string[] }>
      artistas: {
        Row: {
          bio: string | null
          created_at: string | null
          id: number
          name: string
          r2_photo_url: string | null
          slug: string
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          id?: number
          name: string
          r2_photo_url?: string | null
          slug: string
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          id?: number
          name?: string
          r2_photo_url?: string | null
          slug?: string
        }
        Relationships: []
      }
      colecciones: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
          r2_cover_url: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          r2_cover_url?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          r2_cover_url?: string | null
          slug?: string
        }
        Relationships: []
      }
      fanzines: {
        Row: {
          content: string | null
          created_at: string | null
          id: number
          published_at: string | null
          r2_images: string[] | null
          slug: string
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: number
          published_at?: string | null
          r2_images?: string[] | null
          slug: string
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: number
          published_at?: string | null
          r2_images?: string[] | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
      peliculas: {
        Row: {
          r2_subtitle_url: string | null
          creator_user_id: string | null
          file_size_bytes: number | null
          genre: string | null
          language: string | null
          status: string | null
          author: string | null
          created_at: string | null
          duration: string | null
          id: number
          r2_poster_url: string | null
          r2_video_url: string | null
          slug: string
          source_page: string | null
          synopsis: string | null
          thumbnail_url: string | null
          title: string
          year: string | null
          youtube_url: string | null
        }
        Insert: {
          r2_subtitle_url?: string | null
          creator_user_id?: string | null
          file_size_bytes?: number | null
          genre?: string | null
          language?: string | null
          status?: string | null
          author?: string | null
          created_at?: string | null
          duration?: string | null
          id?: number
          r2_poster_url?: string | null
          r2_video_url?: string | null
          slug: string
          source_page?: string | null
          synopsis?: string | null
          thumbnail_url?: string | null
          title: string
          year?: string | null
          youtube_url?: string | null
        }
        Update: {
          r2_subtitle_url?: string | null
          creator_user_id?: string | null
          file_size_bytes?: number | null
          genre?: string | null
          language?: string | null
          status?: string | null
          author?: string | null
          created_at?: string | null
          duration?: string | null
          id?: number
          r2_poster_url?: string | null
          r2_video_url?: string | null
          slug?: string
          source_page?: string | null
          synopsis?: string | null
          thumbnail_url?: string | null
          title?: string
          year?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      peliculas_artistas: {
        Row: {
          artista_id: number
          pelicula_id: number
        }
        Insert: {
          artista_id: number
          pelicula_id: number
        }
        Update: {
          artista_id?: number
          pelicula_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "peliculas_artistas_artista_id_fkey"
            columns: ["artista_id"]
            isOneToOne: false
            referencedRelation: "artistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peliculas_artistas_pelicula_id_fkey"
            columns: ["pelicula_id"]
            isOneToOne: false
            referencedRelation: "film_scores"
            referencedColumns: ["pelicula_id"]
          },
          {
            foreignKeyName: "peliculas_artistas_pelicula_id_fkey"
            columns: ["pelicula_id"]
            isOneToOne: false
            referencedRelation: "peliculas"
            referencedColumns: ["id"]
          },
        ]
      }
      peliculas_colecciones: {
        Row: {
          coleccion_id: number
          pelicula_id: number
        }
        Insert: {
          coleccion_id: number
          pelicula_id: number
        }
        Update: {
          coleccion_id?: number
          pelicula_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "peliculas_colecciones_coleccion_id_fkey"
            columns: ["coleccion_id"]
            isOneToOne: false
            referencedRelation: "colecciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peliculas_colecciones_pelicula_id_fkey"
            columns: ["pelicula_id"]
            isOneToOne: false
            referencedRelation: "film_scores"
            referencedColumns: ["pelicula_id"]
          },
          {
            foreignKeyName: "peliculas_colecciones_pelicula_id_fkey"
            columns: ["pelicula_id"]
            isOneToOne: false
            referencedRelation: "peliculas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string | null
          avatar_id: string | null
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_color?: string | null
          avatar_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_color?: string | null
          avatar_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      review_likes: {
        Row: {
          id:               number
          liker_user_id:    string
          reviewer_user_id: string
          pelicula_id:      number
          created_at:       string
        }
        Insert: {
          id?:              number
          liker_user_id:    string
          reviewer_user_id: string
          pelicula_id:      number
          created_at?:      string
        }
        Update: {
          id?:              number
          liker_user_id?:   string
          reviewer_user_id?: string
          pelicula_id?:     number
          created_at?:      string
        }
        Relationships: []
      }
      synopsis_proposals: {
        Row: {
          id:            number
          user_id:       string
          pelicula_id:   number
          proposed_text: string
          created_at:    string
        }
        Insert: {
          id?:           number
          user_id:       string
          pelicula_id:   number
          proposed_text: string
          created_at?:   string
        }
        Update: {
          id?:            number
          user_id?:       string
          pelicula_id?:   number
          proposed_text?: string
          created_at?:    string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string
          id: number
          pelicula_id: number
          profile_id: string
          rated_at: string
          score: number
          user_id: string
        }
        Insert: {
          comment?: string
          id?: number
          pelicula_id: number
          profile_id?: string
          rated_at?: string
          score: number
          user_id: string
        }
        Update: {
          comment?: string
          id?: number
          pelicula_id?: number
          profile_id?: string
          rated_at?: string
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      sub_profiles: {
        Row: {
          autoplay: boolean
          avatar_id: string
          color: string
          created_at: string
          id: string
          is_kids: boolean
          name: string
          pin: string | null
          require_pin: boolean
          user_id: string
        }
        Insert: {
          autoplay?: boolean
          avatar_id: string
          color: string
          created_at?: string
          id?: string
          is_kids?: boolean
          name: string
          pin?: string | null
          require_pin?: boolean
          user_id: string
        }
        Update: {
          autoplay?: boolean
          avatar_id?: string
          color?: string
          created_at?: string
          id?: string
          is_kids?: boolean
          name?: string
          pin?: string | null
          require_pin?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          duration: number
          pelicula_slug: string
          updated_at: string
          user_id: string
          watch_time: number
        }
        Insert: {
          duration?: number
          pelicula_slug: string
          updated_at?: string
          user_id: string
          watch_time?: number
        }
        Update: {
          duration?: number
          pelicula_slug?: string
          updated_at?: string
          user_id?: string
          watch_time?: number
        }
        Relationships: []
      }
      user_ratings: {
        Row: {
          pelicula_slug: string
          rated_at: string
          rating: number
          review: string
          user_id: string
        }
        Insert: {
          pelicula_slug: string
          rated_at?: string
          rating: number
          review?: string
          user_id: string
        }
        Update: {
          pelicula_slug?: string
          rated_at?: string
          rating?: number
          review?: string
          user_id?: string
        }
        Relationships: []
      }
      user_watchlist: {
        Row: {
          added_at: string
          pelicula_slug: string
          user_id: string
        }
        Insert: {
          added_at?: string
          pelicula_slug: string
          user_id: string
        }
        Update: {
          added_at?: string
          pelicula_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      view_history: {
        Row: {
          completed: boolean
          id: number
          last_position: number
          last_watched_at: string
          pelicula_id: number
          profile_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          id?: number
          last_position?: number
          last_watched_at?: string
          pelicula_id: number
          profile_id?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          id?: number
          last_position?: number
          last_watched_at?: string
          pelicula_id?: number
          profile_id?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          added_at: string
          id: number
          pelicula_id: number
          profile_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: number
          pelicula_id: number
          profile_id?: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: number
          pelicula_id?: number
          profile_id?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          creator_hearted: boolean
          edited_at: string | null
          pinned_at: string | null
          profile_id: string
          avatar_color: string | null
          content: string
          created_at: string
          display_name: string
          id: number
          is_deleted: boolean
          like_count: number
          parent_id: number | null
          pelicula_id: number
          reply_to_id: number | null
          timestamp_ref: number | null
          user_id: string
        }
        Insert: {
          creator_hearted?: boolean
          edited_at?: string | null
          pinned_at?: string | null
          profile_id?: string
          avatar_color?: string | null
          content: string
          created_at?: string
          display_name?: string
          id?: never
          is_deleted?: boolean
          like_count?: number
          parent_id?: number | null
          pelicula_id: number
          reply_to_id?: number | null
          timestamp_ref?: number | null
          user_id: string
        }
        Update: {
          creator_hearted?: boolean
          edited_at?: string | null
          pinned_at?: string | null
          profile_id?: string
          avatar_color?: string | null
          content?: string
          created_at?: string
          display_name?: string
          id?: never
          is_deleted?: boolean
          like_count?: number
          parent_id?: number | null
          pelicula_id?: number
          timestamp_ref?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      pelicula_extras: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          id: number
          kind: string
          media_ref: string | null
          pelicula_id: number
          poster_url: string | null
          provider: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: never
          kind?: string
          media_ref?: string | null
          pelicula_id: number
          poster_url?: string | null
          provider?: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: never
          kind?: string
          media_ref?: string | null
          pelicula_id?: number
          poster_url?: string | null
          provider?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "pelicula_extras_pelicula_id_fkey"
            columns: ["pelicula_id"]
            isOneToOne: false
            referencedRelation: "peliculas"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reports: {
        Row: {
          comment_id: number
          created_at: string
          id: number
          reason: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          comment_id: number
          created_at?: string
          id?: never
          reason?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          comment_id?: number
          created_at?: string
          id?: never
          reason?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: number
          created_at: string
          profile_id: string
          user_id: string
        }
        Insert: {
          comment_id: number
          created_at?: string
          profile_id?: string
          user_id: string
        }
        Update: {
          comment_id?: number
          created_at?: string
          profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      film_scores: {
        Row: {
          approval_score: number | null
          pelicula_id: number | null
          rating_count: number | null
          slug: string | null
          view_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      gma_media_command: { Args: { p_owner: string; p_action: string; p_payload: Json }; Returns: Json }
      gma_media_transfer_claim: { Args: { p_owner: string; p_session_id: string; p_generation: number; p_writer: string }; Returns: Json }
      gma_media_transfer_commit: { Args: { p_owner: string; p_session_id: string; p_generation: number; p_writer: string; p_fence: number; p_start_byte: number; p_end_byte: number; p_sha256: string; p_storage_relative: string; p_upstream_confirmed?: boolean }; Returns: Json }
      gma_media_transfer_renew: { Args: { p_owner: string; p_session_id: string; p_generation: number; p_writer: string; p_fence: number }; Returns: Json }
      gma_media_transfer_release: { Args: { p_owner: string; p_session_id: string; p_generation: number; p_writer: string; p_fence: number }; Returns: Json }
      gma_media_gateway_state: { Args: { p_owner: string; p_session_id: string; p_generation: number; p_writer: string; p_fence: number; p_patch: Json; p_provider_media_id?: string | null }; Returns: boolean }
      gma_media_gateway_grant: { Args: { p_owner: string | null; p_asset_id: string; p_generation: number; p_draft_id: string | null; p_title_slug: string | null; p_token_hash: string; p_expires_at: string }; Returns: boolean }
      gma_media_gateway_output: { Args: { p_asset_id: string; p_generation: number; p_relative: string; p_token_hash: string }; Returns: Json }
      gma_media_local_inventory: { Args: Record<string, never>; Returns: Json }
      gma_media_authorize: { Args: { p_asset_id: string; p_owner: string | null; p_title_slug: string | null }; Returns: Json }
      gma_media_output_authorized: { Args: { p_asset_id: string; p_relative: string; p_owner: string | null; p_title_slug?: string | null }; Returns: Json }
      gma_title_command: { Args: { p_owner: string; p_action: string; p_payload: Json }; Returns: Json }
      gma_title_restore_version: { Args: { p_owner: string; p_title_id: number; p_expected_revision: number; p_restore_revision: number; p_idempotency_key: string }; Returns: Json }
      gma_upload_command: { Args: { p_owner: string; p_action: string; p_payload: Json }; Returns: Json }
      [key: string]: { Args: Record<string, unknown>; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
