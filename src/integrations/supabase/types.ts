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
      audit_records: {
        Row: {
          bundle_created_at: string | null
          bundle_json: Json
          bundle_version: string
          canonical_json: string
          certificate_hash: string
          certificate_verified: boolean | null
          claim_type: string | null
          created_at: string
          expected_animation_hash: string | null
          expected_image_hash: string | null
          id: string
          import_source: string | null
          imported_by: string | null
          last_verified_at: string | null
          mode: string
          render_status: string | null
          render_verified: boolean | null
          statement: string | null
          subject: string | null
          title: string | null
        }
        Insert: {
          bundle_created_at?: string | null
          bundle_json: Json
          bundle_version: string
          canonical_json: string
          certificate_hash: string
          certificate_verified?: boolean | null
          claim_type?: string | null
          created_at?: string
          expected_animation_hash?: string | null
          expected_image_hash?: string | null
          id?: string
          import_source?: string | null
          imported_by?: string | null
          last_verified_at?: string | null
          mode: string
          render_status?: string | null
          render_verified?: boolean | null
          statement?: string | null
          subject?: string | null
          title?: string | null
        }
        Update: {
          bundle_created_at?: string | null
          bundle_json?: Json
          bundle_version?: string
          canonical_json?: string
          certificate_hash?: string
          certificate_verified?: boolean | null
          claim_type?: string | null
          created_at?: string
          expected_animation_hash?: string | null
          expected_image_hash?: string | null
          id?: string
          import_source?: string | null
          imported_by?: string | null
          last_verified_at?: string | null
          mode?: string
          render_status?: string | null
          render_verified?: boolean | null
          statement?: string | null
          subject?: string | null
          title?: string | null
        }
        Relationships: []
      }
      recertification_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          expected_hash: string | null
          http_status: number | null
          id: string
          node_endpoint: string
          output_hash: string | null
          protocol_defaulted: boolean | null
          protocol_version: string | null
          record_id: string
          request_fingerprint: string | null
          runtime_hash: string | null
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          expected_hash?: string | null
          http_status?: number | null
          id?: string
          node_endpoint: string
          output_hash?: string | null
          protocol_defaulted?: boolean | null
          protocol_version?: string | null
          record_id: string
          request_fingerprint?: string | null
          runtime_hash?: string | null
          status: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          expected_hash?: string | null
          http_status?: number | null
          id?: string
          node_endpoint?: string
          output_hash?: string | null
          protocol_defaulted?: boolean | null
          protocol_version?: string | null
          record_id?: string
          request_fingerprint?: string | null
          runtime_hash?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recertification_runs_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "audit_records"
            referencedColumns: ["id"]
          },
        ]
      }
      sealed_claims: {
        Row: {
          animation_hash: string | null
          bundle_json: Json
          bundle_version: string
          claim_type: string | null
          created_at: string
          event_date: string | null
          id: string
          keywords: string | null
          mode: string
          poster_hash: string
          sources: Json | null
          statement: string | null
          subject: string | null
          title: string | null
        }
        Insert: {
          animation_hash?: string | null
          bundle_json: Json
          bundle_version: string
          claim_type?: string | null
          created_at?: string
          event_date?: string | null
          id?: string
          keywords?: string | null
          mode: string
          poster_hash: string
          sources?: Json | null
          statement?: string | null
          subject?: string | null
          title?: string | null
        }
        Update: {
          animation_hash?: string | null
          bundle_json?: Json
          bundle_version?: string
          claim_type?: string | null
          created_at?: string
          event_date?: string | null
          id?: string
          keywords?: string | null
          mode?: string
          poster_hash?: string
          sources?: Json | null
          statement?: string | null
          subject?: string | null
          title?: string | null
        }
        Relationships: []
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
