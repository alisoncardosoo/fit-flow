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
      achievements: {
        Row: {
          code: string
          description: string | null
          earned_at: string
          icon: string | null
          id: string
          metadata: Json | null
          tier: string
          title: string
          user_id: string
        }
        Insert: {
          code: string
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          metadata?: Json | null
          tier?: string
          title: string
          user_id: string
        }
        Update: {
          code?: string
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          metadata?: Json | null
          tier?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      active_sessions: {
        Row: {
          current_exercise_index: number
          current_exercise_name: string | null
          session_id: string
          started_at: string
          total_exercises: number
          updated_at: string
          user_id: string
          workout_name: string
        }
        Insert: {
          current_exercise_index?: number
          current_exercise_name?: string | null
          session_id: string
          started_at?: string
          total_exercises?: number
          updated_at?: string
          user_id: string
          workout_name: string
        }
        Update: {
          current_exercise_index?: number
          current_exercise_name?: string | null
          session_id?: string
          started_at?: string
          total_exercises?: number
          updated_at?: string
          user_id?: string
          workout_name?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          created_at: string
          expires_at: string
          generated_at: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          payload: Json
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          body_fat: number | null
          created_at: string
          id: string
          measured_at: string
          notes: string | null
          user_id: string
          weight: number
        }
        Insert: {
          body_fat?: number | null
          created_at?: string
          id?: string
          measured_at?: string
          notes?: string | null
          user_id: string
          weight: number
        }
        Update: {
          body_fat?: number | null
          created_at?: string
          id?: string
          measured_at?: string
          notes?: string | null
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          id: string
          joined_at: string
          score: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          id?: string
          joined_at?: string
          score?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          id?: string
          joined_at?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          ends_at: string
          id: string
          is_public: boolean
          period: Database["public"]["Enums"]["challenge_period"]
          starts_at: string
          title: string
          type: Database["public"]["Enums"]["challenge_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          ends_at: string
          id?: string
          is_public?: boolean
          period?: Database["public"]["Enums"]["challenge_period"]
          starts_at?: string
          title: string
          type?: Database["public"]["Enums"]["challenge_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          ends_at?: string
          id?: string
          is_public?: boolean
          period?: Database["public"]["Enums"]["challenge_period"]
          starts_at?: string
          title?: string
          type?: Database["public"]["Enums"]["challenge_type"]
          updated_at?: string
        }
        Relationships: []
      }
      exercise_image_map: {
        Row: {
          created_at: string
          exercise_name_pt: string
          slug: string
          source: string
        }
        Insert: {
          created_at?: string
          exercise_name_pt: string
          slug: string
          source?: string
        }
        Update: {
          created_at?: string
          exercise_name_pt?: string
          slug?: string
          source?: string
        }
        Relationships: []
      }
      exercise_image_overrides: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          image_url: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          image_url: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          image_url?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_image_overrides_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          description: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          equipment: Database["public"]["Enums"]["equipment_type"]
          id: string
          image_url: string | null
          is_public: boolean
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          name: string
          secondary_muscles:
            | Database["public"]["Enums"]["muscle_group"][]
            | null
          tips: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          equipment?: Database["public"]["Enums"]["equipment_type"]
          id?: string
          image_url?: string | null
          is_public?: boolean
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          name: string
          secondary_muscles?:
            | Database["public"]["Enums"]["muscle_group"][]
            | null
          tips?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          equipment?: Database["public"]["Enums"]["equipment_type"]
          id?: string
          image_url?: string | null
          is_public?: boolean
          muscle_group?: Database["public"]["Enums"]["muscle_group"]
          name?: string
          secondary_muscles?:
            | Database["public"]["Enums"]["muscle_group"][]
            | null
          tips?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      friend_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          achieved_at: string | null
          created_at: string
          current_override: number | null
          deadline: string | null
          exercise_id: string | null
          id: string
          notes: string | null
          start_value: number
          target_value: number
          title: string
          type: Database["public"]["Enums"]["goal_type"]
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string
          current_override?: number | null
          deadline?: string | null
          exercise_id?: string | null
          id?: string
          notes?: string | null
          start_value?: number
          target_value: number
          title: string
          type: Database["public"]["Enums"]["goal_type"]
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          created_at?: string
          current_override?: number | null
          deadline?: string | null
          exercise_id?: string | null
          id?: string
          notes?: string | null
          start_value?: number
          target_value?: number
          title?: string
          type?: Database["public"]["Enums"]["goal_type"]
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_goals: {
        Row: {
          created_at: string
          id: string
          month: number
          target_sessions: number
          target_volume: number | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          target_sessions?: number
          target_volume?: number | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          target_sessions?: number
          target_volume?: number | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          payload: Json | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_reps: number
          default_rest_seconds: number
          default_sets: number
          display_name: string | null
          goal: Database["public"]["Enums"]["fitness_goal"] | null
          id: string
          level: Database["public"]["Enums"]["fitness_level"] | null
          onboarded: boolean
          total_points: number
          updated_at: string
          user_id: string
          username: string | null
          weekly_target: number
        }
        Insert: {
          created_at?: string
          default_reps?: number
          default_rest_seconds?: number
          default_sets?: number
          display_name?: string | null
          goal?: Database["public"]["Enums"]["fitness_goal"] | null
          id?: string
          level?: Database["public"]["Enums"]["fitness_level"] | null
          onboarded?: boolean
          total_points?: number
          updated_at?: string
          user_id: string
          username?: string | null
          weekly_target?: number
        }
        Update: {
          created_at?: string
          default_reps?: number
          default_rest_seconds?: number
          default_sets?: number
          display_name?: string | null
          goal?: Database["public"]["Enums"]["fitness_goal"] | null
          id?: string
          level?: Database["public"]["Enums"]["fitness_level"] | null
          onboarded?: boolean
          total_points?: number
          updated_at?: string
          user_id?: string
          username?: string | null
          weekly_target?: number
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          api_key: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          emoji: Database["public"]["Enums"]["reaction_emoji"]
          from_user_id: string
          id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          emoji: Database["public"]["Enums"]["reaction_emoji"]
          from_user_id: string
          id?: string
          session_id: string
        }
        Update: {
          created_at?: string
          emoji?: Database["public"]["Enums"]["reaction_emoji"]
          from_user_id?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_sheets: {
        Row: {
          archived: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          updated_at: string
          workout_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          updated_at?: string
          workout_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_sheets_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      set_logs: {
        Row: {
          completed_at: string
          exercise_id: string
          id: string
          reps: number
          rest_seconds: number | null
          session_id: string
          set_number: number
          user_id: string
          weight: number
        }
        Insert: {
          completed_at?: string
          exercise_id: string
          id?: string
          reps: number
          rest_seconds?: number | null
          session_id: string
          set_number: number
          user_id: string
          weight?: number
        }
        Update: {
          completed_at?: string
          exercise_id?: string
          id?: string
          reps?: number
          rest_seconds?: number | null
          session_id?: string
          set_number?: number
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          exercise_id: string
          id: string
          notes: string | null
          position: number
          rest_seconds: number
          sheet_id: string | null
          target_reps: number
          target_sets: number
          target_weight: number | null
          workout_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          notes?: string | null
          position?: number
          rest_seconds?: number
          sheet_id?: string | null
          target_reps?: number
          target_sets?: number
          target_weight?: number | null
          workout_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          notes?: string | null
          position?: number
          rest_seconds?: number
          sheet_id?: string | null
          target_reps?: number
          target_sets?: number
          target_weight?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "routine_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          duration_seconds: number | null
          finished_at: string | null
          id: string
          notes: string | null
          sheet_id: string | null
          started_at: string
          total_volume: number | null
          user_id: string
          workout_id: string | null
          workout_name: string
        }
        Insert: {
          duration_seconds?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          sheet_id?: string | null
          started_at?: string
          total_volume?: number | null
          user_id: string
          workout_id?: string | null
          workout_name: string
        }
        Update: {
          duration_seconds?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          sheet_id?: string | null
          started_at?: string
          total_volume?: number | null
          user_id?: string
          workout_id?: string | null
          workout_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "routine_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          description: string | null
          id: string
          last_sheet_id: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_sheet_id?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_sheet_id?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_last_sheet_id_fkey"
            columns: ["last_sheet_id"]
            isOneToOne: false
            referencedRelation: "routine_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      generate_friend_code: { Args: never; Returns: string }
      get_exercise_pr: {
        Args: { _exercise_id: string; _user_id: string }
        Returns: number
      }
      get_friend_comparison: {
        Args: { _days?: number; _friend: string; _me: string }
        Returns: {
          avg_duration_min: number
          display_name: string
          frequency_days: number
          sessions: number
          total_volume: number
          user_id: string
        }[]
      }
      get_friend_ranking: {
        Args: { _end: string; _start: string; _user_id: string }
        Returns: {
          display_name: string
          points: number
          sessions: number
          total_volume: number
          user_id: string
        }[]
      }
      get_monthly_progress: {
        Args: { _month: number; _user_id: string; _year: number }
        Returns: {
          sessions_count: number
          total_volume: number
        }[]
      }
      get_public_profiles: {
        Args: { _ids: string[] }
        Returns: {
          display_name: string
          user_id: string
          username: string
        }[]
      }
      get_total_sessions: { Args: { _user_id: string }; Returns: number }
      get_user_streak: { Args: { _user_id: string }; Returns: number }
      is_username_available: { Args: { _username: string }; Returns: boolean }
      public_handle: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      challenge_period: "weekly" | "monthly" | "custom"
      challenge_type: "most_sessions" | "most_volume" | "most_frequency"
      difficulty_level: "beginner" | "intermediate" | "advanced"
      equipment_type:
        | "barbell"
        | "dumbbell"
        | "machine"
        | "cable"
        | "bodyweight"
        | "kettlebell"
        | "band"
        | "other"
      fitness_goal:
        | "hypertrophy"
        | "weight_loss"
        | "conditioning"
        | "strength"
        | "endurance"
      fitness_level: "beginner" | "intermediate" | "advanced"
      friendship_status: "pending" | "accepted" | "declined" | "blocked"
      goal_type:
        | "bodyweight"
        | "exercise_load"
        | "weekly_frequency"
        | "monthly_frequency"
        | "custom"
      muscle_group:
        | "chest"
        | "back"
        | "shoulders"
        | "biceps"
        | "triceps"
        | "forearms"
        | "quads"
        | "hamstrings"
        | "glutes"
        | "calves"
        | "core"
        | "cardio"
        | "full_body"
      notification_type:
        | "friend_request"
        | "friend_accepted"
        | "friend_workout"
        | "reaction_received"
        | "challenge_invite"
        | "challenge_overtaken"
        | "challenge_won"
      reaction_emoji: "flex" | "fire" | "clap"
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
    Enums: {
      challenge_period: ["weekly", "monthly", "custom"],
      challenge_type: ["most_sessions", "most_volume", "most_frequency"],
      difficulty_level: ["beginner", "intermediate", "advanced"],
      equipment_type: [
        "barbell",
        "dumbbell",
        "machine",
        "cable",
        "bodyweight",
        "kettlebell",
        "band",
        "other",
      ],
      fitness_goal: [
        "hypertrophy",
        "weight_loss",
        "conditioning",
        "strength",
        "endurance",
      ],
      fitness_level: ["beginner", "intermediate", "advanced"],
      friendship_status: ["pending", "accepted", "declined", "blocked"],
      goal_type: [
        "bodyweight",
        "exercise_load",
        "weekly_frequency",
        "monthly_frequency",
        "custom",
      ],
      muscle_group: [
        "chest",
        "back",
        "shoulders",
        "biceps",
        "triceps",
        "forearms",
        "quads",
        "hamstrings",
        "glutes",
        "calves",
        "core",
        "cardio",
        "full_body",
      ],
      notification_type: [
        "friend_request",
        "friend_accepted",
        "friend_workout",
        "reaction_received",
        "challenge_invite",
        "challenge_overtaken",
        "challenge_won",
      ],
      reaction_emoji: ["flex", "fire", "clap"],
    },
  },
} as const
