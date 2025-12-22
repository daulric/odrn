export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  ordn: {
    Tables: {
      call_signals: {
        Row: {
          id: string;
          call_id: string;
          sender_id: string;
          recipient_id: string | null;
          type: 'offer' | 'answer' | 'ice' | 'renegotiate' | 'hangup' | 'control';
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          call_id: string;
          sender_id: string;
          recipient_id?: string | null;
          type: 'offer' | 'answer' | 'ice' | 'renegotiate' | 'hangup' | 'control';
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          call_id?: string;
          sender_id?: string;
          recipient_id?: string | null;
          type?: 'offer' | 'answer' | 'ice' | 'renegotiate' | 'hangup' | 'control';
          payload?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_signals_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_signals_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      calls: {
        Row: {
          id: string;
          caller_id: string;
          callee_id: string;
          status: 'ringing' | 'accepted' | 'declined' | 'missed' | 'ended' | 'cancelled';
          created_at: string;
          updated_at: string;
          accepted_at: string | null;
          ended_at: string | null;
          end_reason: string | null;
          client_version: string | null;
        };
        Insert: {
          id?: string;
          caller_id: string;
          callee_id: string;
          status?: 'ringing' | 'accepted' | 'declined' | 'missed' | 'ended' | 'cancelled';
          created_at?: string;
          updated_at?: string;
          accepted_at?: string | null;
          ended_at?: string | null;
          end_reason?: string | null;
          client_version?: string | null;
        };
        Update: {
          id?: string;
          caller_id?: string;
          callee_id?: string;
          status?: 'ringing' | 'accepted' | 'declined' | 'missed' | 'ended' | 'cancelled';
          created_at?: string;
          updated_at?: string;
          accepted_at?: string | null;
          ended_at?: string | null;
          end_reason?: string | null;
          client_version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calls_caller_id_fkey";
            columns: ["caller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_callee_id_fkey";
            columns: ["callee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          id: string;
          username: string | null;
          email: string | null;
          avatar: string | null;
          created_at: string | null;
          is_online: boolean | null;
          last_seen: string | null;
        };
        Insert: {
          id: string;
          username?: string | null;
          email?: string | null;
          avatar?: string | null;
          created_at?: string | null;
          is_online?: boolean | null;
          last_seen?: string | null;
        };
        Update: {
          id?: string;
          username?: string | null;
          email?: string | null;
          avatar?: string | null;
          created_at?: string | null;
          is_online?: boolean | null;
          last_seen?: string | null;
        };
        Relationships: [];
      };
      friends: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: 'pending' | 'accepted';
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: 'pending' | 'accepted';
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          friend_id?: string;
          status?: 'pending' | 'accepted';
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "friends_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friends_friend_id_fkey";
            columns: ["friend_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      posts: {
        Row: {
          id: string;
          userid: string;
          content: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          userid: string;
          content?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          userid?: string;
          content?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "posts_userid_fkey";
            columns: ["userid"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      post_images: {
        Row: {
          id: string;
          post_id: string;
          image_url: string;
          order_index: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          post_id: string;
          image_url: string;
          order_index?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          post_id?: string;
          image_url?: string;
          order_index?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "post_images_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          content: string;
          sender_id: string;
          receiver_id: string;
          created_at: string;
          seen: boolean;
        };
        Insert: {
          id?: string;
          content: string;
          sender_id: string;
          receiver_id: string;
          created_at?: string;
          seen?: boolean;
        };
        Update: {
          id?: string;
          content?: string;
          sender_id?: string;
          receiver_id?: string;
          created_at?: string;
          seen?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_receiver_id_fkey";
            columns: ["receiver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
