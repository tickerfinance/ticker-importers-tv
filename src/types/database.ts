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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      tv_channel_statistics: {
        Row: {
          calculated_total_comments: number | null
          calculated_total_likes: number | null
          channel_slug: string
          created_at: string | null
          date: string
          id: number
          subscriber_count: number | null
          total_channel_views: number | null
          total_videos: number | null
        }
        Insert: {
          calculated_total_comments?: number | null
          calculated_total_likes?: number | null
          channel_slug: string
          created_at?: string | null
          date: string
          id?: number
          subscriber_count?: number | null
          total_channel_views?: number | null
          total_videos?: number | null
        }
        Update: {
          calculated_total_comments?: number | null
          calculated_total_likes?: number | null
          channel_slug?: string
          created_at?: string | null
          date?: string
          id?: number
          subscriber_count?: number | null
          total_channel_views?: number | null
          total_videos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_channel_statistics_channel_slug_fkey"
            columns: ["channel_slug"]
            isOneToOne: false
            referencedRelation: "tv_channels"
            referencedColumns: ["slug"]
          },
        ]
      }
      tv_channels: {
        Row: {
          created_at: string | null
          name: string
          slug: string
          visible: boolean | null
          youtube_id: string | null
        }
        Insert: {
          created_at?: string | null
          name: string
          slug: string
          visible?: boolean | null
          youtube_id?: string | null
        }
        Update: {
          created_at?: string | null
          name?: string
          slug?: string
          visible?: boolean | null
          youtube_id?: string | null
        }
        Relationships: []
      }
      tv_media_items: {
        Row: {
          apple_podcasts_url: string | null
          channel_slug: string | null
          comments: number | null
          content_type: string | null
          created_at: string | null
          date: string | null
          description: string | null
          duration: string | null
          id: string
          image: string | null
          likes: number | null
          title: string
          views: number | null
          youtube_id: string | null
          youtube_url: string | null
        }
        Insert: {
          apple_podcasts_url?: string | null
          channel_slug?: string | null
          comments?: number | null
          content_type?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          duration?: string | null
          id: string
          image?: string | null
          likes?: number | null
          title: string
          views?: number | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          apple_podcasts_url?: string | null
          channel_slug?: string | null
          comments?: number | null
          content_type?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          image?: string | null
          likes?: number | null
          title?: string
          views?: number | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_media_items_channel_slug_fkey"
            columns: ["channel_slug"]
            isOneToOne: false
            referencedRelation: "tv_channels"
            referencedColumns: ["slug"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
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