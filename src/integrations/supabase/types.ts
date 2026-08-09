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
      ai_generations: {
        Row: {
          audio_url: string | null
          bpm: number | null
          cover_url: string | null
          created_at: string
          genre: string | null
          id: string
          lyrics: string | null
          mood: string | null
          musical_key: string | null
          production_notes: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          lyrics?: string | null
          mood?: string | null
          musical_key?: string | null
          production_notes?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          lyrics?: string | null
          mood?: string | null
          musical_key?: string | null
          production_notes?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
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
      battle_wins: {
        Row: {
          battle_id: string | null
          battle_title: string
          created_at: string
          declared_at: string
          id: string
          loser_id: string | null
          loser_votes: number
          media_type: string
          winner_cover_url: string | null
          winner_id: string
          winner_media_url: string | null
          winner_title: string | null
          winner_votes: number
        }
        Insert: {
          battle_id?: string | null
          battle_title: string
          created_at?: string
          declared_at?: string
          id?: string
          loser_id?: string | null
          loser_votes?: number
          media_type?: string
          winner_cover_url?: string | null
          winner_id: string
          winner_media_url?: string | null
          winner_title?: string | null
          winner_votes?: number
        }
        Update: {
          battle_id?: string | null
          battle_title?: string
          created_at?: string
          declared_at?: string
          id?: string
          loser_id?: string | null
          loser_votes?: number
          media_type?: string
          winner_cover_url?: string | null
          winner_id?: string
          winner_media_url?: string | null
          winner_title?: string | null
          winner_votes?: number
        }
        Relationships: []
      }
      battles: {
        Row: {
          battle_background: string | null
          challenger_cover_url: string | null
          challenger_id: string
          challenger_media_url: string | null
          challenger_title: string | null
          created_at: string
          expires_at: string | null
          id: string
          likes_count: number
          max_duration_minutes: number | null
          media_type: string
          opponent_cover_url: string | null
          opponent_id: string | null
          opponent_media_url: string | null
          opponent_title: string | null
          status: string
          title: string
          updated_at: string
          views: number
          winner_id: string | null
        }
        Insert: {
          battle_background?: string | null
          challenger_cover_url?: string | null
          challenger_id: string
          challenger_media_url?: string | null
          challenger_title?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          likes_count?: number
          max_duration_minutes?: number | null
          media_type?: string
          opponent_cover_url?: string | null
          opponent_id?: string | null
          opponent_media_url?: string | null
          opponent_title?: string | null
          status?: string
          title: string
          updated_at?: string
          views?: number
          winner_id?: string | null
        }
        Update: {
          battle_background?: string | null
          challenger_cover_url?: string | null
          challenger_id?: string
          challenger_media_url?: string | null
          challenger_title?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          likes_count?: number
          max_duration_minutes?: number | null
          media_type?: string
          opponent_cover_url?: string | null
          opponent_id?: string | null
          opponent_media_url?: string | null
          opponent_title?: string | null
          status?: string
          title?: string
          updated_at?: string
          views?: number
          winner_id?: string | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
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
          created_by: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      deal_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          business_id: string | null
          created_at: string
          deal_id: string | null
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          business_id?: string | null
          created_at?: string
          deal_id?: string | null
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          business_id?: string | null
          created_at?: string
          deal_id?: string | null
          details?: Json | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_audit_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "deal_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_audit_log_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "deal_businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_businesses: {
        Row: {
          address: string | null
          avg_rating: number
          can_publish: boolean
          category: string | null
          city: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          email: string | null
          hours_json: Json
          id: string
          is_verified: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          owner_id: string
          phone: string | null
          postal_code: string | null
          review_count: number
          slug: string | null
          state: string | null
          updated_at: string
          verification_status: string
          website: string | null
        }
        Insert: {
          address?: string | null
          avg_rating?: number
          can_publish?: boolean
          category?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          hours_json?: Json
          id?: string
          is_verified?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          owner_id: string
          phone?: string | null
          postal_code?: string | null
          review_count?: number
          slug?: string | null
          state?: string | null
          updated_at?: string
          verification_status?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          avg_rating?: number
          can_publish?: boolean
          category?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          hours_json?: Json
          id?: string
          is_verified?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          owner_id?: string
          phone?: string | null
          postal_code?: string | null
          review_count?: number
          slug?: string | null
          state?: string | null
          updated_at?: string
          verification_status?: string
          website?: string | null
        }
        Relationships: []
      }
      deal_claims: {
        Row: {
          barcode_value: string | null
          business_id: string
          claimed_at: string
          deal_id: string
          expires_at: string | null
          id: string
          qr_payload: string | null
          redemption_code: string | null
          redemption_type: string
          status: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          barcode_value?: string | null
          business_id: string
          claimed_at?: string
          deal_id: string
          expires_at?: string | null
          id?: string
          qr_payload?: string | null
          redemption_code?: string | null
          redemption_type?: string
          status?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          barcode_value?: string | null
          business_id?: string
          claimed_at?: string
          deal_id?: string
          expires_at?: string | null
          id?: string
          qr_payload?: string | null
          redemption_code?: string | null
          redemption_type?: string
          status?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_claims_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "deal_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_claims_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_images: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          is_cover: boolean
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          is_cover?: boolean
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          is_cover?: boolean
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_images_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_notification_preferences: {
        Row: {
          business_review_result: boolean
          category_new: boolean
          claim_limit_warning: boolean
          claimed_expiring_soon: boolean
          created_at: string
          followed_business_new: boolean
          nearby_new: boolean
          saved_ending_soon: boolean
          sold_out: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          business_review_result?: boolean
          category_new?: boolean
          claim_limit_warning?: boolean
          claimed_expiring_soon?: boolean
          created_at?: string
          followed_business_new?: boolean
          nearby_new?: boolean
          saved_ending_soon?: boolean
          sold_out?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          business_review_result?: boolean
          category_new?: boolean
          claim_limit_warning?: boolean
          claimed_expiring_soon?: boolean
          created_at?: string
          followed_business_new?: boolean
          nearby_new?: boolean
          saved_ending_soon?: boolean
          sold_out?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deal_reports: {
        Row: {
          created_at: string
          deal_id: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_reports_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_reviews: {
        Row: {
          body: string | null
          business_id: string
          business_responded_at: string | null
          business_response: string | null
          claim_id: string
          created_at: string
          deal_id: string
          id: string
          offer_matched: number
          overall: number
          redemption_easy: number
          staff_honored: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          business_id: string
          business_responded_at?: string | null
          business_response?: string | null
          claim_id: string
          created_at?: string
          deal_id: string
          id?: string
          offer_matched?: number
          overall?: number
          redemption_easy?: number
          staff_honored?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          business_id?: string
          business_responded_at?: string | null
          business_response?: string | null
          claim_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          offer_matched?: number
          overall?: number
          redemption_easy?: number
          staff_honored?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "deal_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_reviews_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "deal_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_reviews_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_saves: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_saves_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          address: string | null
          age_restriction: number | null
          barcode_value: string | null
          business_id: string
          category: string
          city: string | null
          claims_count: number
          cover_url: string | null
          created_at: string
          creator_id: string
          currency: string
          deal_price: number | null
          deal_type: string
          description: string
          discount_badge: string | null
          discount_value: number | null
          exclusions: string | null
          expires_at: string
          external_url: string | null
          id: string
          is_featured: boolean
          is_sponsored: boolean
          latitude: number | null
          location_type: string
          longitude: number | null
          map_label: string | null
          minimum_purchase: number | null
          per_user_limit: number
          postal_code: string | null
          promo_code: string | null
          qr_payload: string | null
          redemption_count: number
          redemption_type: string
          regular_price: number | null
          saves_count: number
          slug: string | null
          starts_at: string
          state: string | null
          status: string
          tags: string[] | null
          terms: string | null
          title: string
          total_claim_limit: number | null
          updated_at: string
          views_count: number
        }
        Insert: {
          address?: string | null
          age_restriction?: number | null
          barcode_value?: string | null
          business_id: string
          category: string
          city?: string | null
          claims_count?: number
          cover_url?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          deal_price?: number | null
          deal_type?: string
          description?: string
          discount_badge?: string | null
          discount_value?: number | null
          exclusions?: string | null
          expires_at?: string
          external_url?: string | null
          id?: string
          is_featured?: boolean
          is_sponsored?: boolean
          latitude?: number | null
          location_type?: string
          longitude?: number | null
          map_label?: string | null
          minimum_purchase?: number | null
          per_user_limit?: number
          postal_code?: string | null
          promo_code?: string | null
          qr_payload?: string | null
          redemption_count?: number
          redemption_type?: string
          regular_price?: number | null
          saves_count?: number
          slug?: string | null
          starts_at?: string
          state?: string | null
          status?: string
          tags?: string[] | null
          terms?: string | null
          title: string
          total_claim_limit?: number | null
          updated_at?: string
          views_count?: number
        }
        Update: {
          address?: string | null
          age_restriction?: number | null
          barcode_value?: string | null
          business_id?: string
          category?: string
          city?: string | null
          claims_count?: number
          cover_url?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          deal_price?: number | null
          deal_type?: string
          description?: string
          discount_badge?: string | null
          discount_value?: number | null
          exclusions?: string | null
          expires_at?: string
          external_url?: string | null
          id?: string
          is_featured?: boolean
          is_sponsored?: boolean
          latitude?: number | null
          location_type?: string
          longitude?: number | null
          map_label?: string | null
          minimum_purchase?: number | null
          per_user_limit?: number
          postal_code?: string | null
          promo_code?: string | null
          qr_payload?: string | null
          redemption_count?: number
          redemption_type?: string
          regular_price?: number | null
          saves_count?: number
          slug?: string | null
          starts_at?: string
          state?: string | null
          status?: string
          tags?: string[] | null
          terms?: string | null
          title?: string
          total_claim_limit?: number | null
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "deal_businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_profiles: {
        Row: {
          company_name: string
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          updated_at: string
          user_id: string
          verified: boolean
          website: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
          website?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
          website?: string | null
        }
        Relationships: []
      }
      event_listings: {
        Row: {
          address: string | null
          capacity: number | null
          category: string
          created_at: string
          description: string | null
          ends_at: string | null
          expires_at: string | null
          id: string
          map_url: string | null
          media_type: string
          media_url: string | null
          price_cents: number | null
          starts_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          category?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          expires_at?: string | null
          id?: string
          map_url?: string | null
          media_type?: string
          media_url?: string | null
          price_cents?: number | null
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
          category?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          expires_at?: string | null
          id?: string
          map_url?: string | null
          media_type?: string
          media_url?: string | null
          price_cents?: number | null
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
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
      fundraiser_campaigns: {
        Row: {
          category: string
          cover_image: string | null
          created_at: string
          description: string
          expires_at: string | null
          goal_amount: number
          id: string
          raised_amount: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          cover_image?: string | null
          created_at?: string
          description: string
          expires_at?: string | null
          goal_amount: number
          id?: string
          raised_amount?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          cover_image?: string | null
          created_at?: string
          description?: string
          expires_at?: string | null
          goal_amount?: number
          id?: string
          raised_amount?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fundraiser_donations: {
        Row: {
          amount: number
          anonymous: boolean
          campaign_id: string
          created_at: string
          donor_user_id: string | null
          id: string
          message: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount: number
          anonymous?: boolean
          campaign_id: string
          created_at?: string
          donor_user_id?: string | null
          id?: string
          message?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          anonymous?: boolean
          campaign_id?: string
          created_at?: string
          donor_user_id?: string | null
          id?: string
          message?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fundraiser_donations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fundraiser_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      game_invites: {
        Row: {
          created_at: string
          from_user_id: string
          game_id: string | null
          game_type: string
          id: string
          message: string | null
          responded_at: string | null
          status: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          game_id?: string | null
          game_type: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          game_id?: string | null
          game_type?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_invites_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_moves: {
        Row: {
          created_at: string
          game_id: string
          id: string
          move: Json
          move_number: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          move: Json
          move_number: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          move?: Json
          move_number?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          created_at: string
          game_id: string
          id: string
          is_computer: boolean
          result: string | null
          seat: number
          symbol: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          is_computer?: boolean
          result?: string | null
          seat: number
          symbol?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          is_computer?: boolean
          result?: string | null
          seat?: number
          symbol?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_stats: {
        Row: {
          best_streak: number
          created_at: string
          current_streak: number
          draws: number
          game_type: string
          games_played: number
          high_score: number
          id: string
          last_played_at: string | null
          losses: number
          updated_at: string
          user_id: string
          wins: number
          xp: number
        }
        Insert: {
          best_streak?: number
          created_at?: string
          current_streak?: number
          draws?: number
          game_type: string
          games_played?: number
          high_score?: number
          id?: string
          last_played_at?: string | null
          losses?: number
          updated_at?: string
          user_id: string
          wins?: number
          xp?: number
        }
        Update: {
          best_streak?: number
          created_at?: string
          current_streak?: number
          draws?: number
          game_type?: string
          games_played?: number
          high_score?: number
          id?: string
          last_played_at?: string | null
          losses?: number
          updated_at?: string
          user_id?: string
          wins?: number
          xp?: number
        }
        Relationships: []
      }
      games: {
        Row: {
          created_at: string
          current_turn_user_id: string | null
          finished_at: string | null
          game_state: Json
          game_type: string
          host_user_id: string
          id: string
          is_draw: boolean
          mode: string
          status: string
          updated_at: string
          winner_user_id: string | null
        }
        Insert: {
          created_at?: string
          current_turn_user_id?: string | null
          finished_at?: string | null
          game_state?: Json
          game_type: string
          host_user_id: string
          id?: string
          is_draw?: boolean
          mode?: string
          status?: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Update: {
          created_at?: string
          current_turn_user_id?: string | null
          finished_at?: string | null
          game_state?: Json
          game_type?: string
          host_user_id?: string
          id?: string
          is_draw?: boolean
          mode?: string
          status?: string
          updated_at?: string
          winner_user_id?: string | null
        }
        Relationships: []
      }
      gig_interests: {
        Row: {
          created_at: string
          experience_bio: string | null
          gig_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          experience_bio?: string | null
          gig_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          experience_bio?: string | null
          gig_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_interests_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gig_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_listings: {
        Row: {
          ai_estimate: Json | null
          assigned_at: string | null
          assigned_to: string | null
          budget_max: number | null
          budget_min: number | null
          cancelled_at: string | null
          category: string
          completed_at: string | null
          created_at: string
          currency: string | null
          description: string
          hide_yaj_profile: boolean
          id: string
          location: string | null
          media: Json | null
          poster_completed_at: string | null
          poster_id: string
          preferred_date: string | null
          preferred_time: string | null
          status: string
          title: string
          updated_at: string
          urgency: string | null
          worker_completed_at: string | null
        }
        Insert: {
          ai_estimate?: Json | null
          assigned_at?: string | null
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          cancelled_at?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          description: string
          hide_yaj_profile?: boolean
          id?: string
          location?: string | null
          media?: Json | null
          poster_completed_at?: string | null
          poster_id: string
          preferred_date?: string | null
          preferred_time?: string | null
          status?: string
          title: string
          updated_at?: string
          urgency?: string | null
          worker_completed_at?: string | null
        }
        Update: {
          ai_estimate?: Json | null
          assigned_at?: string | null
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          cancelled_at?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          description?: string
          hide_yaj_profile?: boolean
          id?: string
          location?: string | null
          media?: Json | null
          poster_completed_at?: string | null
          poster_id?: string
          preferred_date?: string | null
          preferred_time?: string | null
          status?: string
          title?: string
          updated_at?: string
          urgency?: string | null
          worker_completed_at?: string | null
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          address: string | null
          anonymous_mode: boolean
          applicant_accepted: boolean
          applicant_id: string
          application_skills: string[] | null
          availability: string | null
          available_start_date: string | null
          certifications: string[] | null
          cover_letter: string | null
          created_at: string
          desired_position: string | null
          education_history: Json | null
          email: string | null
          employer_accepted: boolean
          employment_history: Json | null
          expected_salary: number | null
          full_name: string | null
          id: string
          job_id: string
          linkedin_url: string | null
          phone: string | null
          portfolio_url: string | null
          references_json: Json | null
          resume_id: string | null
          resume_snapshot: Json | null
          resume_url: string | null
          shift_preference: string | null
          status: string
          target_pay_rate: string | null
          updated_at: string
          willing_to_relocate: boolean | null
          work_authorized: boolean | null
          years_experience: number | null
        }
        Insert: {
          address?: string | null
          anonymous_mode?: boolean
          applicant_accepted?: boolean
          applicant_id: string
          application_skills?: string[] | null
          availability?: string | null
          available_start_date?: string | null
          certifications?: string[] | null
          cover_letter?: string | null
          created_at?: string
          desired_position?: string | null
          education_history?: Json | null
          email?: string | null
          employer_accepted?: boolean
          employment_history?: Json | null
          expected_salary?: number | null
          full_name?: string | null
          id?: string
          job_id: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          references_json?: Json | null
          resume_id?: string | null
          resume_snapshot?: Json | null
          resume_url?: string | null
          shift_preference?: string | null
          status?: string
          target_pay_rate?: string | null
          updated_at?: string
          willing_to_relocate?: boolean | null
          work_authorized?: boolean | null
          years_experience?: number | null
        }
        Update: {
          address?: string | null
          anonymous_mode?: boolean
          applicant_accepted?: boolean
          applicant_id?: string
          application_skills?: string[] | null
          availability?: string | null
          available_start_date?: string | null
          certifications?: string[] | null
          cover_letter?: string | null
          created_at?: string
          desired_position?: string | null
          education_history?: Json | null
          email?: string | null
          employer_accepted?: boolean
          employment_history?: Json | null
          expected_salary?: number | null
          full_name?: string | null
          id?: string
          job_id?: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          references_json?: Json | null
          resume_id?: string | null
          resume_snapshot?: Json | null
          resume_url?: string | null
          shift_preference?: string | null
          status?: string
          target_pay_rate?: string | null
          updated_at?: string
          willing_to_relocate?: boolean | null
          work_authorized?: boolean | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_listings: {
        Row: {
          benefits: string[] | null
          category: string
          created_at: string
          deadline: string | null
          description: string
          education: string | null
          employer_id: string
          employment_type: string
          experience_level: string | null
          external_apply_url: string | null
          id: string
          location: string | null
          media: Json | null
          qualifications: string[] | null
          remote_mode: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          skills: string[] | null
          status: string
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          benefits?: string[] | null
          category?: string
          created_at?: string
          deadline?: string | null
          description: string
          education?: string | null
          employer_id: string
          employment_type?: string
          experience_level?: string | null
          external_apply_url?: string | null
          id?: string
          location?: string | null
          media?: Json | null
          qualifications?: string[] | null
          remote_mode?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          skills?: string[] | null
          status?: string
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          benefits?: string[] | null
          category?: string
          created_at?: string
          deadline?: string | null
          description?: string
          education?: string | null
          employer_id?: string
          employment_type?: string
          experience_level?: string | null
          external_apply_url?: string | null
          id?: string
          location?: string | null
          media?: Json | null
          qualifications?: string[] | null
          remote_mode?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          skills?: string[] | null
          status?: string
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      job_preferences: {
        Row: {
          alert_keywords: string[] | null
          availability: string | null
          categories: string[] | null
          created_at: string
          employment_types: string[] | null
          experience_level: string | null
          hybrid_ok: boolean | null
          id: string
          locations: string[] | null
          notify_frequency: string | null
          onsite_ok: boolean | null
          radius: number | null
          remote_ok: boolean | null
          salary_expect: number | null
          titles: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_keywords?: string[] | null
          availability?: string | null
          categories?: string[] | null
          created_at?: string
          employment_types?: string[] | null
          experience_level?: string | null
          hybrid_ok?: boolean | null
          id?: string
          locations?: string[] | null
          notify_frequency?: string | null
          onsite_ok?: boolean | null
          radius?: number | null
          remote_ok?: boolean | null
          salary_expect?: number | null
          titles?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_keywords?: string[] | null
          availability?: string | null
          categories?: string[] | null
          created_at?: string
          employment_types?: string[] | null
          experience_level?: string | null
          hybrid_ok?: boolean | null
          id?: string
          locations?: string[] | null
          notify_frequency?: string | null
          onsite_ok?: boolean | null
          radius?: number | null
          remote_ok?: boolean | null
          salary_expect?: number | null
          titles?: string[] | null
          updated_at?: string
          user_id?: string
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
      live_session_participants: {
        Row: {
          client_instance_id: string | null
          display_name: string | null
          id: string
          is_live: boolean
          joined_at: string
          left_at: string | null
          live_session_id: string
          mic_muted: boolean
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_instance_id?: string | null
          display_name?: string | null
          id?: string
          is_live?: boolean
          joined_at?: string
          left_at?: string | null
          live_session_id: string
          mic_muted?: boolean
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_instance_id?: string | null
          display_name?: string | null
          id?: string
          is_live?: boolean
          joined_at?: string
          left_at?: string | null
          live_session_id?: string
          mic_muted?: boolean
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_session_participants_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          booking_id: string | null
          created_at: string
          created_by: string
          ended_at: string | null
          id: string
          session_code: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          created_by: string
          ended_at?: string | null
          id?: string
          session_code: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          session_code?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "studio_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          listing_id: string
          qty: number
          unit_price: number
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          listing_id: string
          qty?: number
          unit_price?: number
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "marketplace_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_cart_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_carts: {
        Row: {
          buyer_id: string
          created_at: string
          delivery_address: string | null
          delivery_fee: number
          delivery_miles: number | null
          fulfillment: string
          id: string
          note: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_miles?: number | null
          fulfillment?: string
          id?: string
          note?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_miles?: number | null
          fulfillment?: string
          id?: string
          note?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_listing_media: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          listing_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          listing_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          listing_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_media_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          attributes: Json
          brand: string | null
          category: string
          city: string | null
          color: string | null
          condition: string | null
          cover_url: string | null
          created_at: string
          deleted_at: string | null
          delivery: boolean
          delivery_fee: number
          description: string
          firm_price: boolean
          id: string
          lat: number | null
          listing_type: string
          lng: number | null
          local_pickup: boolean
          location_approx: string | null
          model: string | null
          open_to_offers: boolean
          price: number | null
          promoted: boolean
          quantity: number
          seller_id: string
          shipping: boolean
          state: string | null
          status: string
          subcategory: string | null
          tags: string[]
          title: string
          updated_at: string
          views_count: number
          zip: string | null
        }
        Insert: {
          attributes?: Json
          brand?: string | null
          category?: string
          city?: string | null
          color?: string | null
          condition?: string | null
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery?: boolean
          delivery_fee?: number
          description?: string
          firm_price?: boolean
          id?: string
          lat?: number | null
          listing_type?: string
          lng?: number | null
          local_pickup?: boolean
          location_approx?: string | null
          model?: string | null
          open_to_offers?: boolean
          price?: number | null
          promoted?: boolean
          quantity?: number
          seller_id: string
          shipping?: boolean
          state?: string | null
          status?: string
          subcategory?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          views_count?: number
          zip?: string | null
        }
        Update: {
          attributes?: Json
          brand?: string | null
          category?: string
          city?: string | null
          color?: string | null
          condition?: string | null
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery?: boolean
          delivery_fee?: number
          description?: string
          firm_price?: boolean
          id?: string
          lat?: number | null
          listing_type?: string
          lng?: number | null
          local_pickup?: boolean
          location_approx?: string | null
          model?: string | null
          open_to_offers?: boolean
          price?: number | null
          promoted?: boolean
          quantity?: number
          seller_id?: string
          shipping?: boolean
          state?: string | null
          status?: string
          subcategory?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          views_count?: number
          zip?: string | null
        }
        Relationships: []
      }
      marketplace_offers: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          id: string
          listing_id: string
          message: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          id?: string
          listing_id: string
          message?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          message?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_offers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          delivery_max_miles: number
          delivery_min_fee: number
          delivery_per_mile: number
          display_name: string | null
          is_business: boolean
          response_time_minutes: number | null
          service_area: string | null
          store_address: string | null
          store_banner_url: string | null
          store_lat: number | null
          store_lng: number | null
          store_name: string | null
          store_tagline: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          delivery_max_miles?: number
          delivery_min_fee?: number
          delivery_per_mile?: number
          display_name?: string | null
          is_business?: boolean
          response_time_minutes?: number | null
          service_area?: string | null
          store_address?: string | null
          store_banner_url?: string | null
          store_lat?: number | null
          store_lng?: number | null
          store_name?: string | null
          store_tagline?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          delivery_max_miles?: number
          delivery_min_fee?: number
          delivery_per_mile?: number
          display_name?: string | null
          is_business?: boolean
          response_time_minutes?: number | null
          service_area?: string | null
          store_address?: string | null
          store_banner_url?: string | null
          store_lat?: number | null
          store_lng?: number | null
          store_name?: string | null
          store_tagline?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_saved_listings: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_vehicle_details: {
        Row: {
          boat_type: string | null
          body_style: string | null
          cylinders: number | null
          dealer: boolean
          drivetrain: string | null
          engine: string | null
          engine_hours: number | null
          engine_size: string | null
          engine_type: string | null
          exterior_color: string | null
          extras: Json
          fuel_type: string | null
          hull_material: string | null
          interior_color: string | null
          length_ft: number | null
          listing_id: string
          make: string | null
          mileage: number | null
          model: string | null
          motorcycle_type: string | null
          rv_type: string | null
          sleeping_capacity: number | null
          slide_outs: number | null
          title_status: string | null
          trailer_included: boolean | null
          transmission: string | null
          trim: string | null
          vin: string | null
          year: number | null
        }
        Insert: {
          boat_type?: string | null
          body_style?: string | null
          cylinders?: number | null
          dealer?: boolean
          drivetrain?: string | null
          engine?: string | null
          engine_hours?: number | null
          engine_size?: string | null
          engine_type?: string | null
          exterior_color?: string | null
          extras?: Json
          fuel_type?: string | null
          hull_material?: string | null
          interior_color?: string | null
          length_ft?: number | null
          listing_id: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          motorcycle_type?: string | null
          rv_type?: string | null
          sleeping_capacity?: number | null
          slide_outs?: number | null
          title_status?: string | null
          trailer_included?: boolean | null
          transmission?: string | null
          trim?: string | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          boat_type?: string | null
          body_style?: string | null
          cylinders?: number | null
          dealer?: boolean
          drivetrain?: string | null
          engine?: string | null
          engine_hours?: number | null
          engine_size?: string | null
          engine_type?: string | null
          exterior_color?: string | null
          extras?: Json
          fuel_type?: string | null
          hull_material?: string | null
          interior_color?: string | null
          length_ft?: number | null
          listing_id?: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          motorcycle_type?: string | null
          rv_type?: string | null
          sleeping_capacity?: number | null
          slide_outs?: number | null
          title_status?: string | null
          trailer_included?: boolean | null
          transmission?: string | null
          trim?: string | null
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_vehicle_details_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
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
          images: string[] | null
          read: boolean | null
          receiver_id: string | null
          sender_id: string
          thread_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          images?: string[] | null
          read?: boolean | null
          receiver_id?: string | null
          sender_id: string
          thread_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          images?: string[] | null
          read?: boolean | null
          receiver_id?: string | null
          sender_id?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_type: string
          actor_id: string | null
          created_at: string
          details: string | null
          duration_hours: number | null
          ends_at: string | null
          id: string
          offense_number: number | null
          reason: string
          target_user_id: string
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          duration_hours?: number | null
          ends_at?: string | null
          id?: string
          offense_number?: number | null
          reason: string
          target_user_id: string
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          duration_hours?: number | null
          ends_at?: string | null
          id?: string
          offense_number?: number | null
          reason?: string
          target_user_id?: string
        }
        Relationships: []
      }
      moderation_appeals: {
        Row: {
          admin_response: string | null
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      no_show_strikes: {
        Row: {
          booking_id: string
          created_at: string
          engineer_id: string
          id: string
          reported_by: string
          studio_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          engineer_id: string
          id?: string
          reported_by: string
          studio_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          engineer_id?: string
          id?: string
          reported_by?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "no_show_strikes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "studio_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_show_strikes_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          read: boolean
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
          link?: string | null
          message?: string | null
          read?: boolean
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
          link?: string | null
          message?: string | null
          read?: boolean
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
      podcast_chat_messages: {
        Row: {
          body: string
          created_at: string
          episode_id: string
          id: string
          sender_name: string
          sender_user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          episode_id: string
          id?: string
          sender_name: string
          sender_user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          episode_id?: string
          id?: string
          sender_name?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_chat_messages_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_clips: {
        Row: {
          created_at: string
          end_seconds: number
          episode_id: string
          format: string
          id: string
          r2_key: string | null
          start_seconds: number
          title: string | null
        }
        Insert: {
          created_at?: string
          end_seconds: number
          episode_id: string
          format?: string
          id?: string
          r2_key?: string | null
          start_seconds: number
          title?: string | null
        }
        Update: {
          created_at?: string
          end_seconds?: number
          episode_id?: string
          format?: string
          id?: string
          r2_key?: string | null
          start_seconds?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_clips_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_episodes: {
        Row: {
          ai_chapters: Json | null
          ai_show_notes: string | null
          ai_soundbites: Json | null
          ai_summary: string | null
          ai_titles: Json | null
          cover_url: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          ended_at: string | null
          host_user_id: string
          id: string
          is_streaming: boolean
          livekit_room: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          ai_chapters?: Json | null
          ai_show_notes?: string | null
          ai_soundbites?: Json | null
          ai_summary?: string | null
          ai_titles?: Json | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          host_user_id: string
          id?: string
          is_streaming?: boolean
          livekit_room: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          ai_chapters?: Json | null
          ai_show_notes?: string | null
          ai_soundbites?: Json | null
          ai_summary?: string | null
          ai_titles?: Json | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          host_user_id?: string
          id?: string
          is_streaming?: boolean
          livekit_room?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      podcast_participants: {
        Row: {
          created_at: string
          display_name: string
          episode_id: string
          id: string
          invite_token: string
          joined_at: string | null
          left_at: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          episode_id: string
          id?: string
          invite_token?: string
          joined_at?: string | null
          left_at?: string | null
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          episode_id?: string
          id?: string
          invite_token?: string
          joined_at?: string | null
          left_at?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_participants_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_recordings: {
        Row: {
          byte_size: number | null
          chunk_count: number
          created_at: string
          duration_seconds: number | null
          edl: Json | null
          episode_id: string
          id: string
          magic_audio_status: string | null
          mime_type: string
          participant_id: string | null
          processed_audio_key: string | null
          r2_prefix: string
          status: string
          track_kind: string
          updated_at: string
          uploader_user_id: string | null
        }
        Insert: {
          byte_size?: number | null
          chunk_count?: number
          created_at?: string
          duration_seconds?: number | null
          edl?: Json | null
          episode_id: string
          id?: string
          magic_audio_status?: string | null
          mime_type?: string
          participant_id?: string | null
          processed_audio_key?: string | null
          r2_prefix: string
          status?: string
          track_kind?: string
          updated_at?: string
          uploader_user_id?: string | null
        }
        Update: {
          byte_size?: number | null
          chunk_count?: number
          created_at?: string
          duration_seconds?: number | null
          edl?: Json | null
          episode_id?: string
          id?: string
          magic_audio_status?: string | null
          mime_type?: string
          participant_id?: string | null
          processed_audio_key?: string | null
          r2_prefix?: string
          status?: string
          track_kind?: string
          updated_at?: string
          uploader_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_recordings_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_recordings_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "podcast_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_stream_destinations: {
        Row: {
          created_at: string
          enabled: boolean
          episode_id: string
          id: string
          platform: string
          rtmp_url: string
          stream_key: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          episode_id: string
          id?: string
          platform: string
          rtmp_url: string
          stream_key: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          episode_id?: string
          id?: string
          platform?: string
          rtmp_url?: string
          stream_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_stream_destinations_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_transcripts: {
        Row: {
          created_at: string
          episode_id: string
          error: string | null
          id: string
          language: string | null
          recording_id: string | null
          segments: Json | null
          status: string
          text: string
          updated_at: string
          words: Json | null
        }
        Insert: {
          created_at?: string
          episode_id: string
          error?: string | null
          id?: string
          language?: string | null
          recording_id?: string | null
          segments?: Json | null
          status?: string
          text?: string
          updated_at?: string
          words?: Json | null
        }
        Update: {
          created_at?: string
          episode_id?: string
          error?: string | null
          id?: string
          language?: string | null
          recording_id?: string | null
          segments?: Json | null
          status?: string
          text?: string
          updated_at?: string
          words?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_transcripts_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_transcripts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "podcast_recordings"
            referencedColumns: ["id"]
          },
        ]
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
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji_id: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji_id: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji_id?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
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
          views: number
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
          views?: number
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
          views?: number
        }
        Relationships: []
      }
      pro_profiles: {
        Row: {
          about: string | null
          banner_url: string | null
          business_hours: string | null
          business_name: string | null
          categories: string[]
          certifications: string[]
          created_at: string
          hired_count: number
          hourly_rate: number | null
          insurance_note: string | null
          is_active: boolean
          languages: string[]
          logo_url: string | null
          media: Json
          project_types: Json
          responds_minutes: number | null
          service_area: string | null
          similar_jobs_count: number
          skills: string[]
          updated_at: string
          user_id: string
          website: string | null
          work_focus: Json
        }
        Insert: {
          about?: string | null
          banner_url?: string | null
          business_hours?: string | null
          business_name?: string | null
          categories?: string[]
          certifications?: string[]
          created_at?: string
          hired_count?: number
          hourly_rate?: number | null
          insurance_note?: string | null
          is_active?: boolean
          languages?: string[]
          logo_url?: string | null
          media?: Json
          project_types?: Json
          responds_minutes?: number | null
          service_area?: string | null
          similar_jobs_count?: number
          skills?: string[]
          updated_at?: string
          user_id: string
          website?: string | null
          work_focus?: Json
        }
        Update: {
          about?: string | null
          banner_url?: string | null
          business_hours?: string | null
          business_name?: string | null
          categories?: string[]
          certifications?: string[]
          created_at?: string
          hired_count?: number
          hourly_rate?: number | null
          insurance_note?: string | null
          is_active?: boolean
          languages?: string[]
          logo_url?: string | null
          media?: Json
          project_types?: Json
          responds_minutes?: number | null
          service_area?: string | null
          similar_jobs_count?: number
          skills?: string[]
          updated_at?: string
          user_id?: string
          website?: string | null
          work_focus?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          background_image_url: string | null
          banner_url: string | null
          bio: string | null
          country_flag: string | null
          created_at: string
          custom_accent_color: string | null
          daw_shortcuts: Json | null
          display_name: string | null
          email: string | null
          gig_experience_bio: string | null
          hide_yaj_page_on_gigs: boolean
          id: string
          moderation_offense_count: number
          moderation_public_note: string | null
          moderation_reason: string | null
          moderation_status: string
          moderation_until: string | null
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
          country_flag?: string | null
          created_at?: string
          custom_accent_color?: string | null
          daw_shortcuts?: Json | null
          display_name?: string | null
          email?: string | null
          gig_experience_bio?: string | null
          hide_yaj_page_on_gigs?: boolean
          id?: string
          moderation_offense_count?: number
          moderation_public_note?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          moderation_until?: string | null
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
          country_flag?: string | null
          created_at?: string
          custom_accent_color?: string | null
          daw_shortcuts?: Json | null
          display_name?: string | null
          email?: string | null
          gig_experience_bio?: string | null
          hide_yaj_page_on_gigs?: boolean
          id?: string
          moderation_offense_count?: number
          moderation_public_note?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          moderation_until?: string | null
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
      recording_exports: {
        Row: {
          artist_name: string | null
          audio_url: string | null
          cover_url: string | null
          created_at: string
          id: string
          session_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          artist_name?: string | null
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          session_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          artist_name?: string | null
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          session_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_exports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recording_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_sessions: {
        Row: {
          beat_name: string | null
          beat_url: string | null
          cover_url: string | null
          created_at: string
          id: string
          is_draft: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          beat_name?: string | null
          beat_url?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          is_draft?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          beat_name?: string | null
          beat_url?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          is_draft?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recording_takes: {
        Row: {
          audio_url: string | null
          created_at: string
          duration: number
          id: string
          muted: boolean
          name: string
          session_id: string
          solo: boolean
          trim_end: number
          trim_start: number
          user_id: string
          waveform_data: Json | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration?: number
          id?: string
          muted?: boolean
          name?: string
          session_id: string
          solo?: boolean
          trim_end?: number
          trim_start?: number
          user_id: string
          waveform_data?: Json | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration?: number
          id?: string
          muted?: boolean
          name?: string
          session_id?: string
          solo?: boolean
          trim_end?: number
          trim_start?: number
          user_id?: string
          waveform_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_takes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recording_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          is_default: boolean
          source: string
          structured_data: Json | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          is_default?: boolean
          source?: string
          structured_data?: Json | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          is_default?: boolean
          source?: string
          structured_data?: Json | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_circle_donations: {
        Row: {
          amount: number
          circle_id: string
          created_at: string
          donor_member_id: string
          id: string
          period_number: number
          reason: string | null
          recipient_member_id: string
        }
        Insert: {
          amount: number
          circle_id: string
          created_at?: string
          donor_member_id: string
          id?: string
          period_number: number
          reason?: string | null
          recipient_member_id: string
        }
        Update: {
          amount?: number
          circle_id?: string
          created_at?: string
          donor_member_id?: string
          id?: string
          period_number?: number
          reason?: string | null
          recipient_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_circle_donations_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "savings_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_circle_members: {
        Row: {
          circle_id: string
          display_name: string
          has_received_pot: boolean
          id: string
          joined_at: string
          payment_method: string | null
          position: number
          user_id: string
        }
        Insert: {
          circle_id: string
          display_name: string
          has_received_pot?: boolean
          id?: string
          joined_at?: string
          payment_method?: string | null
          position: number
          user_id: string
        }
        Update: {
          circle_id?: string
          display_name?: string
          has_received_pot?: boolean
          id?: string
          joined_at?: string
          payment_method?: string | null
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "savings_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_circle_payments: {
        Row: {
          circle_id: string
          id: string
          member_id: string
          paid: boolean
          paid_at: string | null
          period_number: number
        }
        Insert: {
          circle_id: string
          id?: string
          member_id: string
          paid?: boolean
          paid_at?: string | null
          period_number: number
        }
        Update: {
          circle_id?: string
          id?: string
          member_id?: string
          paid?: boolean
          paid_at?: string | null
          period_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "savings_circle_payments_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "savings_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_circle_periods: {
        Row: {
          circle_id: string
          due_date: string
          id: string
          period_number: number
          status: string
        }
        Insert: {
          circle_id: string
          due_date: string
          id?: string
          period_number: number
          status?: string
        }
        Update: {
          circle_id?: string
          due_date?: string
          id?: string
          period_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_circle_periods_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "savings_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_circle_terms_acceptance: {
        Row: {
          accepted_at: string
          id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_circles: {
        Row: {
          allowed_payment_methods: string[] | null
          amount_per_period: number
          created_at: string
          current_members: number
          current_period: number
          frequency: string
          id: string
          invite_code: string | null
          max_members: number
          name: string
          owner_id: string
          requires_verified_plus: boolean | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          allowed_payment_methods?: string[] | null
          amount_per_period: number
          created_at?: string
          current_members?: number
          current_period?: number
          frequency: string
          id?: string
          invite_code?: string | null
          max_members: number
          name: string
          owner_id: string
          requires_verified_plus?: boolean | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          allowed_payment_methods?: string[] | null
          amount_per_period?: number
          created_at?: string
          current_members?: number
          current_period?: number
          frequency?: string
          id?: string
          invite_code?: string | null
          max_members?: number
          name?: string
          owner_id?: string
          requires_verified_plus?: boolean | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      sound_library: {
        Row: {
          bpm: number | null
          category: string
          color: string | null
          created_at: string
          duration_sec: number | null
          genre: string | null
          id: string
          is_active: boolean
          musical_key: string | null
          name: string
          pack: string | null
          r2_key: string
          tags: string[] | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bpm?: number | null
          category: string
          color?: string | null
          created_at?: string
          duration_sec?: number | null
          genre?: string | null
          id?: string
          is_active?: boolean
          musical_key?: string | null
          name: string
          pack?: string | null
          r2_key: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bpm?: number | null
          category?: string
          color?: string | null
          created_at?: string
          duration_sec?: number | null
          genre?: string | null
          id?: string
          is_active?: boolean
          musical_key?: string | null
          name?: string
          pack?: string | null
          r2_key?: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
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
          approval_deadline: string | null
          artist_confirmed: boolean | null
          artist_responded_at: string | null
          booking_date: string
          cancellation_fee: number
          cancelled_at: string | null
          created_at: string
          engineer_completed_at: string | null
          hours: number
          id: string
          payout_status: string
          session_code: string | null
          session_status: string
          status: string
          studio_id: string
          total_amount: number
          user_id: string
        }
        Insert: {
          approval_deadline?: string | null
          artist_confirmed?: boolean | null
          artist_responded_at?: string | null
          booking_date: string
          cancellation_fee?: number
          cancelled_at?: string | null
          created_at?: string
          engineer_completed_at?: string | null
          hours?: number
          id?: string
          payout_status?: string
          session_code?: string | null
          session_status?: string
          status?: string
          studio_id: string
          total_amount?: number
          user_id: string
        }
        Update: {
          approval_deadline?: string | null
          artist_confirmed?: boolean | null
          artist_responded_at?: string | null
          booking_date?: string
          cancellation_fee?: number
          cancelled_at?: string | null
          created_at?: string
          engineer_completed_at?: string | null
          hours?: number
          id?: string
          payout_status?: string
          session_code?: string | null
          session_status?: string
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
          auto_accept: boolean
          created_at: string
          daily_rate: number | null
          description: string | null
          engineer_available: boolean | null
          equipment: string[] | null
          hourly_rate: number
          id: string
          location: string
          name: string
          no_show_count: number | null
          rating: number | null
          reviews_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_accept?: boolean
          created_at?: string
          daily_rate?: number | null
          description?: string | null
          engineer_available?: boolean | null
          equipment?: string[] | null
          hourly_rate?: number
          id?: string
          location: string
          name: string
          no_show_count?: number | null
          rating?: number | null
          reviews_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_accept?: boolean
          created_at?: string
          daily_rate?: number | null
          description?: string | null
          engineer_available?: boolean | null
          equipment?: string[] | null
          hourly_rate?: number
          id?: string
          location?: string
          name?: string
          no_show_count?: number | null
          rating?: number | null
          reviews_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          category: string | null
          created_at: string
          id: string
          images: string[] | null
          message: string
          priority: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          subject: string
          updated_at: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          admin_response?: string | null
          category?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          message: string
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          admin_response?: string | null
          category?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          message?: string
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      threads: {
        Row: {
          circle_id: string | null
          created_at: string
          group_name: string | null
          id: string
          is_group: boolean | null
          last_message_at: string
          participant_ids: string[]
        }
        Insert: {
          circle_id?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string
          participant_ids: string[]
        }
        Update: {
          circle_id?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string
          participant_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "threads_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "savings_circles"
            referencedColumns: ["id"]
          },
        ]
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
      tv_post_comments: {
        Row: {
          created_at: string
          id: string
          post_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tv_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tv_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_posts: {
        Row: {
          created_at: string
          description: string | null
          duration_ms: number | null
          ext: string | null
          id: string
          kind: string
          mime: string | null
          thumb_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_key: string | null
          video_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_ms?: number | null
          ext?: string | null
          id?: string
          kind: string
          mime?: string | null
          thumb_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_key?: string | null
          video_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_ms?: number | null
          ext?: string | null
          id?: string
          kind?: string
          mime?: string | null
          thumb_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_key?: string | null
          video_url?: string
        }
        Relationships: []
      }
      user_ratings: {
        Row: {
          comment: string | null
          context_id: string
          context_type: string
          created_at: string
          id: string
          ratee_id: string
          rater_id: string
          score: number
          tags: string | null
        }
        Insert: {
          comment?: string | null
          context_id: string
          context_type: string
          created_at?: string
          id?: string
          ratee_id: string
          rater_id: string
          score: number
          tags?: string | null
        }
        Update: {
          comment?: string | null
          context_id?: string
          context_type?: string
          created_at?: string
          id?: string
          ratee_id?: string
          rater_id?: string
          score?: number
          tags?: string | null
        }
        Relationships: []
      }
      user_reputation_summary: {
        Row: {
          last_updated: string
          reliability_score: number
          savings_ratings_count: number
          savings_score: number
          user_id: string
        }
        Insert: {
          last_updated?: string
          reliability_score?: number
          savings_ratings_count?: number
          savings_score?: number
          user_id: string
        }
        Update: {
          last_updated?: string
          reliability_score?: number
          savings_ratings_count?: number
          savings_score?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          payment_status: string | null
          plan_type: string
          start_date: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          payment_status?: string | null
          plan_type?: string
          start_date?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          payment_status?: string | null
          plan_type?: string
          start_date?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          has_payment_method: boolean | null
          id: string
          language: string | null
          location: string | null
          name: string | null
          notification_member_joined: boolean | null
          notification_message_sound: boolean | null
          notification_payment_due: boolean | null
          notification_payment_received: boolean | null
          photo_url: string | null
          privacy_show_email: boolean | null
          streak_count: number | null
          stripe_customer_id: string | null
          tagline: string | null
          updated_at: string
          username: string | null
          username_lower: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          has_payment_method?: boolean | null
          id: string
          language?: string | null
          location?: string | null
          name?: string | null
          notification_member_joined?: boolean | null
          notification_message_sound?: boolean | null
          notification_payment_due?: boolean | null
          notification_payment_received?: boolean | null
          photo_url?: string | null
          privacy_show_email?: boolean | null
          streak_count?: number | null
          stripe_customer_id?: string | null
          tagline?: string | null
          updated_at?: string
          username?: string | null
          username_lower?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          has_payment_method?: boolean | null
          id?: string
          language?: string | null
          location?: string | null
          name?: string | null
          notification_member_joined?: boolean | null
          notification_message_sound?: boolean | null
          notification_payment_due?: boolean | null
          notification_payment_received?: boolean | null
          photo_url?: string | null
          privacy_show_email?: boolean | null
          streak_count?: number | null
          stripe_customer_id?: string | null
          tagline?: string | null
          updated_at?: string
          username?: string | null
          username_lower?: string | null
        }
        Relationships: []
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
      apply_moderation_action: {
        Args: {
          p_action_type: string
          p_details?: string
          p_duration_hours?: number
          p_reason: string
          p_target_user_id: string
        }
        Returns: {
          action_type: string
          actor_id: string | null
          created_at: string
          details: string | null
          duration_hours: number | null
          ends_at: string | null
          id: string
          offense_number: number | null
          reason: string
          target_user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "moderation_actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_manage_deal_business: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      claim_deal: {
        Args: { p_deal_id: string }
        Returns: {
          barcode_value: string | null
          business_id: string
          claimed_at: string
          deal_id: string
          expires_at: string | null
          id: string
          qr_payload: string | null
          redemption_code: string | null
          redemption_type: string
          status: string
          used_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deal_claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_game: {
        Args: {
          p_game_type: string
          p_initial_state: Json
          p_mode: string
          p_opponent_id?: string
        }
        Returns: {
          created_at: string
          current_turn_user_id: string | null
          finished_at: string | null
          game_state: Json
          game_type: string
          host_user_id: string
          id: string
          is_draw: boolean
          mode: string
          status: string
          updated_at: string
          winner_user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_pending_bookings: { Args: never; Returns: number }
      expire_stale_deals: { Args: never; Returns: undefined }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      increment_battle_views: {
        Args: { battle_id: string }
        Returns: undefined
      }
      increment_boost_clicks: { Args: { boost_id: string }; Returns: undefined }
      increment_boost_impressions: {
        Args: { boost_id: string }
        Returns: undefined
      }
      increment_deal_views: { Args: { p_deal_id: string }; Returns: undefined }
      increment_podcast_plays: {
        Args: { podcast_id: string }
        Returns: undefined
      }
      increment_post_views: { Args: { post_id: string }; Returns: undefined }
      increment_song_plays: { Args: { song_id: string }; Returns: undefined }
      increment_video_views: { Args: { video_id: string }; Returns: undefined }
      is_blocked: { Args: { user_a: string; user_b: string }; Returns: boolean }
      is_circle_member: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_game_participant: {
        Args: { _game_id: string; _user_id: string }
        Returns: boolean
      }
      is_podcast_participant: {
        Args: { _episode: string; _user: string }
        Returns: boolean
      }
      lookup_booking_by_session_code: {
        Args: { _code: string }
        Returns: {
          hours: number
          id: string
          session_code: string
          session_status: string
          studio_id: string
          user_id: string
        }[]
      }
      mark_deal_used: {
        Args: { p_claim_id: string }
        Returns: {
          barcode_value: string | null
          business_id: string
          claimed_at: string
          deal_id: string
          expires_at: string | null
          id: string
          qr_payload: string | null
          redemption_code: string | null
          redemption_type: string
          status: string
          used_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deal_claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mp_find_or_create_conversation: {
        Args: { _a: string; _b: string }
        Returns: string
      }
      mp_set_cart_item: {
        Args: { p_listing_id: string; p_qty: number }
        Returns: string
      }
      mp_set_cart_status: {
        Args: { p_cart_id: string; p_delivery_fee?: number; p_status: string }
        Returns: undefined
      }
      mp_submit_cart:
        | {
            Args: {
              p_address?: string
              p_cart_id: string
              p_fulfillment?: string
              p_note?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_address?: string
              p_cart_id: string
              p_fulfillment?: string
              p_miles?: number
              p_note?: string
            }
            Returns: undefined
          }
      refresh_moderation_status: {
        Args: { p_user_id?: string }
        Returns: {
          moderation_offense_count: number
          moderation_public_note: string
          moderation_reason: string
          moderation_status: string
          moderation_until: string
        }[]
      }
      submit_deal_for_review: {
        Args: { p_deal_id: string }
        Returns: {
          address: string | null
          age_restriction: number | null
          barcode_value: string | null
          business_id: string
          category: string
          city: string | null
          claims_count: number
          cover_url: string | null
          created_at: string
          creator_id: string
          currency: string
          deal_price: number | null
          deal_type: string
          description: string
          discount_badge: string | null
          discount_value: number | null
          exclusions: string | null
          expires_at: string
          external_url: string | null
          id: string
          is_featured: boolean
          is_sponsored: boolean
          latitude: number | null
          location_type: string
          longitude: number | null
          map_label: string | null
          minimum_purchase: number | null
          per_user_limit: number
          postal_code: string | null
          promo_code: string | null
          qr_payload: string | null
          redemption_count: number
          redemption_type: string
          regular_price: number | null
          saves_count: number
          slug: string | null
          starts_at: string
          state: string | null
          status: string
          tags: string[] | null
          terms: string | null
          title: string
          total_claim_limit: number | null
          updated_at: string
          views_count: number
        }
        SetofOptions: {
          from: "*"
          to: "deals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suggested_moderation_action: {
        Args: { p_offense_count: number }
        Returns: string
      }
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
