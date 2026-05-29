export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_color?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_color?: string | null
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
      [_ in never]: never
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
