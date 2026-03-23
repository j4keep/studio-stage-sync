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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      battle_comments: {
        Row: {
          battle_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          battle_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          battle_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_comments_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_effects: {
        Row: {
          battle_id: string
          created_at: string
          id: string
          image_url: string
          prompt: string
          side: string
          user_id: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          id?: string
          image_url: string
          prompt: string
          side?: string
          user_id: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          id?: string
          image_url?: string
          prompt?: string
          side?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_effects_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_votes: {
        Row: {
          battle_id: string
          created_at: string
          id: string
          user_id: string
          voted_for: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          id?: string
          user_id: string
          voted_for: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          id?: string
          user_id?: string
          voted_for?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_votes_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          challenger_cover_url: string | null
          challenger_id: string
          challenger_media_url: string | null
          challenger_title: string | null
          created_at: string
          expires_at: string | null
          id: string
          max_duration_minutes: number | null
          media_type: string
          opponent_cover_url: string | null
          opponent_id: string | null
          opponent_media_url: string | null
          opponent_title: string | null
          status: string
          title: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          challenger_cover_url?: string | null
          challenger_id: string
          challenger_media_url?: string | null
          challenger_title?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          max_duration_minutes?: number | null
          media_type?: string
          opponent_cover_url?: string | null
          opponent_id?: string | null
          opponent_media_url?: string | null
          opponent_title?: string | null
          status?: string
          title: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          challenger_cover_url?: string | null
          challenger_id?: string
          challenger_media_url?: string | null
          challenger_title?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          max_duration_minutes?: number | null
          media_type?: string
          opponent_cover_url?: string | null
          opponent_id?: string | null
          opponent_media_url?: string | null
          opponent_title?: string | null
          status?: string
          title?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      boosts: {
        Row: {
          budget: number
          clicks: number
          content_id: string
          content_type: string
          created_at: string
          duration_days: number
          end_date: string
          id: string
          impressions: number
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number
          clicks?: number
          content_id: string
          content_type: string
          created_at?: string
          duration_days?: number
          end_date: string
          id?: string
          impressions?: number
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number
          clicks?: number
          content_id?: string
          content_type?: string
          created_at?: string
          duration_days?: number
          end_date?: string
          id?: string
          impressions?: number
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          is_template: boolean | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_template?: boolean | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_template?: boolean | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          author_id: string
          category: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_free: boolean
          published_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_free?: boolean
          published_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_free?: boolean
          published_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      playlists: {
        Row: {
          created_at: string
          id: string
          items: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      podcasts: {
        Row: {
          cover_url: string | null
          created_at: string
          duration: string | null
          episode: string | null
          id: string
          is_video: boolean | null
          likes_count: number
          media_url: string | null
          plays: string | null
          title: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          duration?: string | null
          episode?: string | null
          id?: string
          is_video?: boolean | null
          likes_count?: number
          media_url?: string | null
          plays?: string | null
          title: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          duration?: string | null
          episode?: string | null
          id?: string
          is_video?: boolean | null
          likes_count?: number
          media_url?: string | null
          plays?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          comments_count: number
          created_at: string
          id: string
          likes_count: number
          media_type: string
          media_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          likes_count?: number
          media_type?: string
          media_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          likes_count?: number
          media_type?: string
          media_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          background_image_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          custom_accent_color: string | null
          display_name: string | null
          email: string | null
          id: string
          terms_accepted_at: string | null
          theme_preset: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          background_image_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          custom_accent_color?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          terms_accepted_at?: string | null
          theme_preset?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          background_image_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          custom_accent_color?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          terms_accepted_at?: string | null
          theme_preset?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          backers: number | null
          categories: string[] | null
          cover_url: string | null
          created_at: string
          deadline: string | null
          description: string | null
          goal: number | null
          id: string
          raised: number | null
          tiers: string[] | null
          title: string
          user_id: string
        }
        Insert: {
          backers?: number | null
          categories?: string[] | null
          cover_url?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          goal?: number | null
          id?: string
          raised?: number | null
          tiers?: string[] | null
          title: string
          user_id: string
        }
        Update: {
          backers?: number | null
          categories?: string[] | null
          cover_url?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          goal?: number | null
          id?: string
          raised?: number | null
          tiers?: string[] | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          id: string
          product_id: string
          stripe_session_id: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          id?: string
          product_id: string
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          id?: string
          product_id?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          album: string | null
          audio_url: string | null
          cover_url: string | null
          created_at: string
          duration: string | null
          genre: string | null
          id: string
          likes_count: number
          on_radio: boolean | null
          plays: string | null
          title: string
          user_id: string
        }
        Insert: {
          album?: string | null
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: string | null
          genre?: string | null
          id?: string
          likes_count?: number
          on_radio?: boolean | null
          plays?: string | null
          title: string
          user_id: string
        }
        Update: {
          album?: string | null
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: string | null
          genre?: string | null
          id?: string
          likes_count?: number
          on_radio?: boolean | null
          plays?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      store_products: {
        Row: {
          artist_name: string | null
          cover_url: string | null
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          preview_url: string | null
          price: number
          sales: number
          tags: string[] | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_name?: string | null
          cover_url?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          preview_url?: string | null
          price?: number
          sales?: number
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_name?: string | null
          cover_url?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          preview_url?: string | null
          price?: number
          sales?: number
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_availability: {
        Row: {
          created_at: string
          date: string
          id: string
          is_booked: boolean | null
          studio_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_booked?: boolean | null
          studio_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_booked?: boolean | null
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_availability_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_bookings: {
        Row: {
          booking_date: string
          created_at: string
          hours: number
          id: string
          status: string
          studio_id: string
          total_amount: number
          user_id: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          hours?: number
          id?: string
          status?: string
          studio_id: string
          total_amount?: number
          user_id: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          hours?: number
          id?: string
          status?: string
          studio_id?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_bookings_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_photos: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          photo_url: string
          studio_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          photo_url: string
          studio_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          photo_url?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_photos_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          studio_id: string
          user_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          studio_id: string
          user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "studio_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_reviews_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          created_at: string
          daily_rate: number | null
          description: string | null
          engineer_available: boolean | null
          equipment: string[] | null
          hourly_rate: number
          id: string
          location: string
          name: string
          rating: number | null
          reviews_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_rate?: number | null
          description?: string | null
          engineer_available?: boolean | null
          equipment?: string[] | null
          hourly_rate?: number
          id?: string
          location: string
          name: string
          rating?: number | null
          reviews_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_rate?: number | null
          description?: string | null
          engineer_available?: boolean | null
          equipment?: string[] | null
          hourly_rate?: number
          id?: string
          location?: string
          name?: string
          rating?: number | null
          reviews_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_replies: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          cover_url: string | null
          created_at: string
          duration: string | null
          id: string
          likes_count: number
          title: string
          user_id: string
          video_url: string | null
          views: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          likes_count?: number
          title: string
          user_id: string
          video_url?: string | null
          views?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          likes_count?: number
          title?: string
          user_id?: string
          video_url?: string | null
          views?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_boost_clicks: { Args: { boost_id: string }; Returns: undefined }
      increment_boost_impressions: {
        Args: { boost_id: string }
        Returns: undefined
      }
      increment_podcast_plays: {
        Args: { podcast_id: string }
        Returns: undefined
      }
      increment_song_plays: { Args: { song_id: string }; Returns: undefined }
      increment_video_views: { Args: { video_id: string }; Returns: undefined }
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
