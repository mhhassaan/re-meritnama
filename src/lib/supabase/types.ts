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
      applicants: {
        Row: {
          applicant_id: number;
          certificates: Json;
          id: number;
          induction: number;
          marks_total: number | null;
          preferences: Json;
          profile_status: number | null;
          updated_at: string;
        };
        Insert: {
          applicant_id: number;
          certificates?: Json;
          id?: never;
          induction: number;
          marks_total?: number | null;
          preferences?: Json;
          profile_status?: number | null;
          updated_at?: string;
        };
        Update: {
          applicant_id?: number;
          certificates?: Json;
          id?: never;
          induction?: number;
          marks_total?: number | null;
          preferences?: Json;
          profile_status?: number | null;
          updated_at?: string;
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
          certificates: Json;
          cnic: string | null;
          consent_rounds: Json;
          contact_number: string | null;
          email_id: string | null;
          father_name: string | null;
          id: number;
          induction: number;
          marks_total: number | null;
          name_full: string;
          pmdc_no: string | null;
          preferences: Json;
          profile_status: number | null;
          updated_at: string;
        };
        Insert: {
          applicant_id: number;
          applied_in?: Json;
          certificates?: Json;
          cnic?: string | null;
          consent_rounds?: Json;
          contact_number?: string | null;
          email_id?: string | null;
          father_name?: string | null;
          id?: never;
          induction?: number;
          marks_total?: number | null;
          name_full: string;
          pmdc_no?: string | null;
          preferences?: Json;
          profile_status?: number | null;
          updated_at?: string;
        };
        Update: {
          applicant_id?: number;
          applied_in?: Json;
          certificates?: Json;
          cnic?: string | null;
          consent_rounds?: Json;
          contact_number?: string | null;
          email_id?: string | null;
          father_name?: string | null;
          id?: never;
          induction?: number;
          marks_total?: number | null;
          name_full?: string;
          pmdc_no?: string | null;
          preferences?: Json;
          profile_status?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          author_id: string;
          author_name: string;
          body: string;
          created_at: string;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
          id: number;
          room_id: string;
        };
        Insert: {
          author_id?: string;
          author_name?: string;
          body: string;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: never;
          room_id: string;
        };
        Update: {
          author_id?: string;
          author_name?: string;
          body?: string;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: never;
          room_id?: string;
        };
        Relationships: [];
      };
      chat_rooms: {
        Row: {
          description: string | null;
          id: string;
          label: string;
          sort_order: number;
          staff_only_write: boolean;
        };
        Insert: {
          description?: string | null;
          id: string;
          label: string;
          sort_order?: number;
          staff_only_write?: boolean;
        };
        Update: {
          description?: string | null;
          id?: string;
          label?: string;
          sort_order?: number;
          staff_only_write?: boolean;
        };
        Relationships: [];
      };
      community_posts: {
        Row: {
          author_id: string;
          author_name: string;
          body: string;
          created_at: string;
          edited_at: string | null;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
          hospital: string | null;
          id: number;
          kind: string;
          rating: number | null;
          rating_balance: number | null;
          rating_seniors: number | null;
          rating_teaching: number | null;
          specialty: string | null;
          title: string;
          training_year: number | null;
          updated_at: string;
        };
        Insert: {
          author_id?: string;
          author_name?: string;
          body: string;
          created_at?: string;
          edited_at?: string | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          hospital?: string | null;
          id?: never;
          kind: string;
          rating?: number | null;
          rating_balance?: number | null;
          rating_seniors?: number | null;
          rating_teaching?: number | null;
          specialty?: string | null;
          title: string;
          training_year?: number | null;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          author_name?: string;
          body?: string;
          created_at?: string;
          edited_at?: string | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          hospital?: string | null;
          id?: never;
          kind?: string;
          rating?: number | null;
          rating_balance?: number | null;
          rating_seniors?: number | null;
          rating_teaching?: number | null;
          specialty?: string | null;
          title?: string;
          training_year?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      community_replies: {
        Row: {
          author_id: string;
          author_name: string;
          body: string;
          created_at: string;
          edited_at: string | null;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
          id: number;
          thread_id: number;
          updated_at: string;
        };
        Insert: {
          author_id?: string;
          author_name?: string;
          body: string;
          created_at?: string;
          edited_at?: string | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: never;
          thread_id: number;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          author_name?: string;
          body?: string;
          created_at?: string;
          edited_at?: string | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: never;
          thread_id?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      community_threads: {
        Row: {
          author_id: string;
          author_name: string;
          body: string;
          category: string;
          created_at: string;
          edited_at: string | null;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
          hospital: string | null;
          id: number;
          last_reply_at: string | null;
          reply_count: number;
          specialty: string | null;
          title: string;
          updated_at: string;
          year_stage: string | null;
        };
        Insert: {
          author_id?: string;
          author_name?: string;
          body: string;
          category: string;
          created_at?: string;
          edited_at?: string | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          hospital?: string | null;
          id?: never;
          last_reply_at?: string | null;
          reply_count?: number;
          specialty?: string | null;
          title: string;
          updated_at?: string;
          year_stage?: string | null;
        };
        Update: {
          author_id?: string;
          author_name?: string;
          body?: string;
          category?: string;
          created_at?: string;
          edited_at?: string | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          hospital?: string | null;
          id?: never;
          last_reply_at?: string | null;
          reply_count?: number;
          specialty?: string | null;
          title?: string;
          updated_at?: string;
          year_stage?: string | null;
        };
        Relationships: [];
      };
      content_reports: {
        Row: {
          action: string | null;
          created_at: string;
          id: number;
          note: string | null;
          reason: string;
          reporter_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          target_id: number;
          target_type: string;
        };
        Insert: {
          action?: string | null;
          created_at?: string;
          id?: never;
          note?: string | null;
          reason: string;
          reporter_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          target_id: number;
          target_type: string;
        };
        Update: {
          action?: string | null;
          created_at?: string;
          id?: never;
          note?: string | null;
          reason?: string;
          reporter_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          target_id?: number;
          target_type?: string;
        };
        Relationships: [];
      };
      data_change_runs: {
        Row: {
          added: number;
          changed: number;
          generated_at: string;
          induction: number;
          new_count: number;
          new_source: string | null;
          old_count: number;
          old_source: string | null;
          removed: number;
          total_updates: number;
          updated_at: string;
        };
        Insert: {
          added: number;
          changed: number;
          generated_at: string;
          induction: number;
          new_count: number;
          new_source?: string | null;
          old_count: number;
          old_source?: string | null;
          removed: number;
          total_updates: number;
          updated_at?: string;
        };
        Update: {
          added?: number;
          changed?: number;
          generated_at?: string;
          induction?: number;
          new_count?: number;
          new_source?: string | null;
          old_count?: number;
          old_source?: string | null;
          removed?: number;
          total_updates?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      data_changes: {
        Row: {
          applicant_id: number;
          field: string;
          id: number;
          induction: number;
          kind: string;
          new_value: number | null;
          old_value: number | null;
          program: string;
          updated_at: string;
        };
        Insert: {
          applicant_id: number;
          field: string;
          id?: never;
          induction: number;
          kind: string;
          new_value?: number | null;
          old_value?: number | null;
          program?: string;
          updated_at?: string;
        };
        Update: {
          applicant_id?: number;
          field?: string;
          id?: never;
          induction?: number;
          kind?: string;
          new_value?: number | null;
          old_value?: number | null;
          program?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      editorial_posts: {
        Row: {
          author_name: string;
          body: string;
          category: string;
          created_at: string;
          created_by: string | null;
          id: number;
          is_published: boolean;
          published_at: string | null;
          read_minutes: number | null;
          slug: string;
          summary: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_name?: string;
          body: string;
          category: string;
          created_at?: string;
          created_by?: string | null;
          id?: never;
          is_published?: boolean;
          published_at?: string | null;
          read_minutes?: number | null;
          slug: string;
          summary: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_name?: string;
          body?: string;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: never;
          is_published?: boolean;
          published_at?: string | null;
          read_minutes?: number | null;
          slug?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          active: boolean;
          body: string;
          created_at: string;
          created_by: string | null;
          dismissable: boolean;
          ends_at: string | null;
          icon: string | null;
          id: number;
          kind: string;
          link: string | null;
          link_text: string | null;
          starts_at: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          body: string;
          created_at?: string;
          created_by?: string | null;
          dismissable?: boolean;
          ends_at?: string | null;
          icon?: string | null;
          id?: never;
          kind?: string;
          link?: string | null;
          link_text?: string | null;
          starts_at?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          dismissable?: boolean;
          ends_at?: string | null;
          icon?: string | null;
          id?: never;
          kind?: string;
          link?: string | null;
          link_text?: string | null;
          starts_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      joining_status: {
        Row: {
          applicant_id: number;
          hospital: string;
          id: number;
          induction: number;
          institute: string | null;
          joined_on: string | null;
          marks: number | null;
          name_full: string | null;
          pmdc_no: string | null;
          preference_no: number | null;
          program: string;
          quota: string;
          seats: number | null;
          specialty: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          applicant_id: number;
          hospital: string;
          id?: never;
          induction: number;
          institute?: string | null;
          joined_on?: string | null;
          marks?: number | null;
          name_full?: string | null;
          pmdc_no?: string | null;
          preference_no?: number | null;
          program: string;
          quota: string;
          seats?: number | null;
          specialty: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          applicant_id?: number;
          hospital?: string;
          id?: never;
          induction?: number;
          institute?: string | null;
          joined_on?: string | null;
          marks?: number | null;
          name_full?: string | null;
          pmdc_no?: string | null;
          preference_no?: number | null;
          program?: string;
          quota?: string;
          seats?: number | null;
          specialty?: string;
          status?: string;
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
      pool_directory: {
        Row: {
          applicant_id: number;
          applied_in: Json;
          certificates: Json;
          components: Json;
          id: number;
          induction: number;
          marks_total: number | null;
          name_full: string | null;
          pmdc_no: string | null;
          preferences: Json;
          profile_status: number | null;
          revisions: Json;
          updated_at: string;
        };
        Insert: {
          applicant_id: number;
          applied_in?: Json;
          certificates?: Json;
          components?: Json;
          id?: never;
          induction: number;
          marks_total?: number | null;
          name_full?: string | null;
          pmdc_no?: string | null;
          preferences?: Json;
          profile_status?: number | null;
          revisions?: Json;
          updated_at?: string;
        };
        Update: {
          applicant_id?: number;
          applied_in?: Json;
          certificates?: Json;
          components?: Json;
          id?: never;
          induction?: number;
          marks_total?: number | null;
          name_full?: string | null;
          pmdc_no?: string | null;
          preferences?: Json;
          profile_status?: number | null;
          revisions?: Json;
          updated_at?: string;
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
      seats: {
        Row: {
          hospital: string;
          id: number;
          induction: number;
          institute: string | null;
          program: string;
          quota: string;
          seats: number;
          specialty: string;
          updated_at: string;
        };
        Insert: {
          hospital: string;
          id?: never;
          induction: number;
          institute?: string | null;
          program: string;
          quota: string;
          seats: number;
          specialty: string;
          updated_at?: string;
        };
        Update: {
          hospital?: string;
          id?: never;
          induction?: number;
          institute?: string | null;
          program?: string;
          quota?: string;
          seats?: number;
          specialty?: string;
          updated_at?: string;
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
      cascade_inputs: {
        Row: {
          applicant_id: number | null;
          certificates: Json | null;
          induction: number | null;
          marks_total: number | null;
          preferences: Json | null;
          profile_status: number | null;
        };
        Relationships: [];
      };
      merit_list_rounds: {
        Row: {
          induction: number | null;
          program: string | null;
          quota: string | null;
          round: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      apply_applicant_pool: {
        Args: { p_induction: number; p_rows: Json };
        Returns: number;
      };
      apply_data_change_run: {
        Args: { p_induction: number; p_run: Json };
        Returns: undefined;
      };
      apply_data_changes: {
        Args: { p_induction: number; p_rows: Json };
        Returns: number;
      };
      apply_joining_status: {
        Args: { p_induction: number; p_rows: Json };
        Returns: number;
      };
      apply_pool_directory: {
        Args: { p_induction: number; p_rows: Json };
        Returns: number;
      };
      apply_portal_inputs: {
        Args: { p_induction: number; p_rows: Json };
        Returns: number;
      };
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
