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
      import_runs: {
        Row: {
          finished_at: string | null
          id: string
          notes: string | null
          source_name: string
          started_at: string
          total_duplicates: number
          total_failed: number
          total_imported: number
          total_missing_images: number
          total_new: number
          total_removed: number
          total_source: number
          total_updated: number
        }
        Insert: {
          finished_at?: string | null
          id?: string
          notes?: string | null
          source_name: string
          started_at?: string
          total_duplicates?: number
          total_failed?: number
          total_imported?: number
          total_missing_images?: number
          total_new?: number
          total_removed?: number
          total_source?: number
          total_updated?: number
        }
        Update: {
          finished_at?: string | null
          id?: string
          notes?: string | null
          source_name?: string
          started_at?: string
          total_duplicates?: number
          total_failed?: number
          total_imported?: number
          total_missing_images?: number
          total_new?: number
          total_removed?: number
          total_source?: number
          total_updated?: number
        }
        Relationships: []
      }
      vehicle_features: {
        Row: {
          created_at: string
          feature_category: string | null
          feature_name: string
          feature_value: string | null
          id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          feature_category?: string | null
          feature_name: string
          feature_value?: string | null
          id?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          feature_category?: string | null
          feature_name?: string
          feature_value?: string | null
          id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_features_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_order: number
          image_type: string | null
          image_url: string
          vehicle_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_order?: number
          image_type?: string | null
          image_url: string
          vehicle_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_order?: number
          image_type?: string | null
          image_url?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_images_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_pricing: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          price_type: string
          vehicle_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          price_type: string
          vehicle_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          price_type?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_pricing_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          body_type: string | null
          brand: string | null
          category: string | null
          chassis_number: string | null
          condition: string | null
          country: string | null
          created_at: string
          currency: string | null
          description: string | null
          doors: number | null
          drive_type: string | null
          drivetrain: string | null
          engine_size: number | null
          engine_type: string | null
          exterior_color: string | null
          fuel: string | null
          gears: number | null
          id: string
          imported_at: string
          inspection: string | null
          insurance: string | null
          interior_color: string | null
          inventory_location: string | null
          last_synced_at: string
          make: string
          mileage: number | null
          mileage_unit: string | null
          model: string
          model_code: string | null
          port: string | null
          price: number | null
          registration_year: number | null
          seats: number | null
          shipment: string | null
          slug: string
          source_name: string | null
          source_updated_at: string | null
          source_url: string | null
          status: string
          steering: string | null
          stock_id: string
          title: string
          transmission: string | null
          updated_at: string
          variant: string | null
          vehicle_type: string | null
          year: number | null
        }
        Insert: {
          body_type?: string | null
          brand?: string | null
          category?: string | null
          chassis_number?: string | null
          condition?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          doors?: number | null
          drive_type?: string | null
          drivetrain?: string | null
          engine_size?: number | null
          engine_type?: string | null
          exterior_color?: string | null
          fuel?: string | null
          gears?: number | null
          id?: string
          imported_at?: string
          inspection?: string | null
          insurance?: string | null
          interior_color?: string | null
          inventory_location?: string | null
          last_synced_at?: string
          make: string
          mileage?: number | null
          mileage_unit?: string | null
          model: string
          model_code?: string | null
          port?: string | null
          price?: number | null
          registration_year?: number | null
          seats?: number | null
          shipment?: string | null
          slug: string
          source_name?: string | null
          source_updated_at?: string | null
          source_url?: string | null
          status?: string
          steering?: string | null
          stock_id: string
          title: string
          transmission?: string | null
          updated_at?: string
          variant?: string | null
          vehicle_type?: string | null
          year?: number | null
        }
        Update: {
          body_type?: string | null
          brand?: string | null
          category?: string | null
          chassis_number?: string | null
          condition?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          doors?: number | null
          drive_type?: string | null
          drivetrain?: string | null
          engine_size?: number | null
          engine_type?: string | null
          exterior_color?: string | null
          fuel?: string | null
          gears?: number | null
          id?: string
          imported_at?: string
          inspection?: string | null
          insurance?: string | null
          interior_color?: string | null
          inventory_location?: string | null
          last_synced_at?: string
          make?: string
          mileage?: number | null
          mileage_unit?: string | null
          model?: string
          model_code?: string | null
          port?: string | null
          price?: number | null
          registration_year?: number | null
          seats?: number | null
          shipment?: string | null
          slug?: string
          source_name?: string | null
          source_updated_at?: string | null
          source_url?: string | null
          status?: string
          steering?: string | null
          stock_id?: string
          title?: string
          transmission?: string | null
          updated_at?: string
          variant?: string | null
          vehicle_type?: string | null
          year?: number | null
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
