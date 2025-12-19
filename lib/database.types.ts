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
