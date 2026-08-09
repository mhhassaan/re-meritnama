// GENERATED FILE — do not edit by hand.
//
// Regenerate after any schema change so the typed clients stay honest about
// what the database actually contains:
//   supabase gen types typescript --project-id xyzsmnckvgysrlpwjibp > src/lib/supabase/types.ts
// (or via the Supabase MCP generate_typescript_types tool)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      access_logs: {
        Row: {
          created_at: string;
          email: string | null;
          id: number;
          ip: string | null;
          page: string | null;
          success: boolean;
          user_agent: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: never;
          ip?: string | null;
          page?: string | null;
          success: boolean;
          user_agent?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: never;
          ip?: string | null;
          page?: string | null;
          success?: boolean;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      access_requests: {
        Row: {
          applicant_id: number | null;
          created_at: string;
          email: string;
          id: number;
          induction: number;
          message: string | null;
          name_full: string | null;
          payment_amount_pkr: number | null;
          payment_declared: boolean;
          payment_reference: string | null;
          payment_verified: boolean;
          proof_object_path: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
        };
        Insert: {
          applicant_id?: number | null;
          created_at?: string;
          email: string;
          id?: never;
          induction?: number;
          message?: string | null;
          name_full?: string | null;
          payment_amount_pkr?: number | null;
          payment_declared?: boolean;
          payment_reference?: string | null;
          payment_verified?: boolean;
          proof_object_path?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
        };
        Update: {
          applicant_id?: number | null;
          created_at?: string;
          email?: string;
          id?: never;
          induction?: number;
          message?: string | null;
          name_full?: string | null;
          payment_amount_pkr?: number | null;
          payment_declared?: boolean;
          payment_reference?: string | null;
          payment_verified?: boolean;
          proof_object_path?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      candidate_links: {
        Row: {
          candidate_id: number;
          linked_at: string;
          linked_by: string;
          user_id: string;
        };
        Insert: {
          candidate_id: number;
          linked_at?: string;
          linked_by?: string;
          user_id: string;
        };
        Update: {
          candidate_id?: number;
          linked_at?: string;
          linked_by?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_links_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: true;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      candidates: {
        Row: {
          applicant_id: number;
          applied_in: Json;
          cnic: string | null;
          contact_number: string | null;
          email_id: string | null;
          father_name: string | null;
          id: number;
          induction: number;
          marks_total: number | null;
          name_full: string;
          pmdc_no: string | null;
          preferences: Json;
          updated_at: string;
        };
        Insert: {
          applicant_id: number;
          applied_in?: Json;
          cnic?: string | null;
          contact_number?: string | null;
          email_id?: string | null;
          father_name?: string | null;
          id?: never;
          induction?: number;
          marks_total?: number | null;
          name_full: string;
          pmdc_no?: string | null;
          preferences?: Json;
          updated_at?: string;
        };
        Update: {
          applicant_id?: number;
          applied_in?: Json;
          cnic?: string | null;
          contact_number?: string | null;
          email_id?: string | null;
          father_name?: string | null;
          id?: never;
          induction?: number;
          marks_total?: number | null;
          name_full?: string;
          pmdc_no?: string | null;
          preferences?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      merit_entries: {
        Row: {
          applicant_id: number;
          cert_bonus: number | null;
          consent_status: string | null;
          created_at: string;
          effective_mark: number | null;
          hospital: string;
          id: number;
          induction: number;
          marks_total: number | null;
          name_full: string;
          placement_status: string | null;
          pmdc_no: string | null;
          preference_no: number | null;
          program: string;
          quota: string;
          round: number;
          row_no: number | null;
          specialty: string;
        };
        Insert: {
          applicant_id: number;
          cert_bonus?: number | null;
          consent_status?: string | null;
          created_at?: string;
          effective_mark?: number | null;
          hospital: string;
          id?: never;
          induction?: number;
          marks_total?: number | null;
          name_full: string;
          placement_status?: string | null;
          pmdc_no?: string | null;
          preference_no?: number | null;
          program: string;
          quota: string;
          round: number;
          row_no?: number | null;
          specialty: string;
        };
        Update: {
          applicant_id?: number;
          cert_bonus?: number | null;
          consent_status?: string | null;
          created_at?: string;
          effective_mark?: number | null;
          hospital?: string;
          id?: never;
          induction?: number;
          marks_total?: number | null;
          name_full?: string;
          placement_status?: string | null;
          pmdc_no?: string | null;
          preference_no?: number | null;
          program?: string;
          quota?: string;
          round?: number;
          row_no?: number | null;
          specialty?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          display_name: string | null;
          hospital_goal: string | null;
          is_public: boolean;
          specialty_goal: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string | null;
          hospital_goal?: string | null;
          is_public?: boolean;
          specialty_goal?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          display_name?: string | null;
          hospital_goal?: string | null;
          is_public?: boolean;
          specialty_goal?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      screenshot_logs: {
        Row: {
          created_at: string;
          id: number;
          page: string | null;
          trace_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: never;
          page?: string | null;
          trace_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: never;
          page?: string | null;
          trace_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_role: "super_admin" | "moderator" | "editorial" | "analyst";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"];
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "moderator", "editorial", "analyst"],
    },
  },
} as const;
