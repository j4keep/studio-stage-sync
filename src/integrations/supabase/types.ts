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
          episode_id: string
          id: string
          mime_type: string
          participant_id: string | null
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
          episode_id: string
          id?: string
          mime_type?: string
          participant_id?: string | null
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
          episode_id?: string
          id?: string
          mime_type?: string
          participant_id?: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          background_image_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          custom_accent_color: string | null
          daw_shortcuts: Json | null
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
          daw_shortcuts?: Json | null
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
          daw_shortcuts?: Json | null
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
      expire_pending_bookings: { Args: never; Returns: number }
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
      increment_podcast_plays: {
        Args: { podcast_id: string }
        Returns: undefined
      }
      increment_post_views: { Args: { post_id: string }; Returns: undefined }
      increment_song_plays: { Args: { song_id: string }; Returns: undefined }
      increment_video_views: { Args: { video_id: string }; Returns: undefined }
      is_blocked: { Args: { user_a: string; user_b: string }; Returns: boolean }
      is_podcast_participant: {
        Args: { _episode: string; _user: string }
        Returns: boolean
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
