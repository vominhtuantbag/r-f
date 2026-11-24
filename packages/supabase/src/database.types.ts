/**
 * Hand-maintained subset of generated Supabase types.
 * Regenerate with: `supabase gen types typescript --local > src/database.types.ts`
 * after migrations stabilize.
 *
 * Shape matches `@supabase/supabase-js` GenericSchema (Tables/Views/Functions/Enums/CompositeTypes).
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type EmptyRelationships = [];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: 'rider' | 'driver' | 'partner' | 'admin' | 'support_agent';
          email: string | null;
          phone: string | null;
          phone_verified: boolean;
          first_name: string;
          last_name: string;
          market_id: string | null;
          wallet_balance_minor: number;
          locale: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: EmptyRelationships;
      };
      markets: {
        Row: {
          id: string;
          name: string;
          slug: string;
          currency_code: string;
          pricing_mode: 'fixed' | 'bidding';
          bidding_enabled: boolean;
          otp_trip_start_enabled: boolean;
          is_active: boolean;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: EmptyRelationships;
      };
      rides: {
        Row: {
          id: string;
          code: string;
          rider_id: string;
          driver_id: string | null;
          market_id: string;
          status: string;
          pricing_mode: 'fixed' | 'bidding';
          otp_required: boolean;
          otp_code: string | null;
          tracking_token: string;
          updated_at?: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: EmptyRelationships;
      };
      fare_bids: {
        Row: {
          id: string;
          ride_id: string;
          driver_id: string;
          amount_minor: number;
          currency_code: string;
          status: string;
          counter_amount_minor: number | null;
          message: string | null;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: EmptyRelationships;
      };
      food_orders: {
        Row: {
          id: string;
          code: string;
          rider_id: string;
          restaurant_id: string;
          driver_id: string | null;
          status: string;
          merged_batch_id: string | null;
          tracking_token: string;
          updated_at?: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: EmptyRelationships;
      };
      merged_order_batches: {
        Row: {
          id: string;
          restaurant_id: string;
          driver_id: string | null;
          status: string;
          updated_at?: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: EmptyRelationships;
      };
      drivers: {
        Row: {
          id: string;
          is_online: boolean;
          last_location: unknown | null;
          last_location_at: string | null;
          heading: number | null;
          speed_mps: number | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: EmptyRelationships;
      };
      support_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: EmptyRelationships;
      };
    };
    Views: {
      v_market_kpis: {
        Row: {
          market_id: string;
          market_name: string;
          currency_code: string;
          rides_completed_today: number;
          orders_delivered_today: number;
          drivers_online: number;
          restaurants_open: number;
          ride_fulfillment_rate_7d: number;
          ride_revenue_minor_today: number;
          food_revenue_minor_today: number;
        };
        Relationships: EmptyRelationships;
      };
    };
    Functions: {
      estimate_ride_fare: {
        Args: {
          p_market_id: string;
          p_vehicle_type_id: string;
          p_distance_meters: number;
          p_duration_seconds: number;
        };
        Returns: Record<string, unknown>[];
      };
      create_ride: {
        Args: {
          p_market_id: string;
          p_vehicle_type_id: string;
          p_stops: Json;
          p_payment_method: string;
          p_is_parcel?: boolean;
          p_is_intercity?: boolean;
          p_scheduled_at?: string | null;
          p_offered_fare_minor?: number | null;
          p_notes?: string | null;
        };
        Returns: Database['public']['Tables']['rides']['Row'];
      };
      transition_ride: {
        Args: {
          p_ride_id: string;
          p_action: string;
          p_otp?: string | null;
          p_lat?: number | null;
          p_lng?: number | null;
        };
        Returns: Database['public']['Tables']['rides']['Row'];
      };
      place_fare_bid: {
        Args: {
          p_ride_id: string;
          p_amount_minor: number;
          p_message?: string | null;
        };
        Returns: Record<string, unknown>;
      };
      accept_fare_bid: {
        Args: { p_ride_id: string; p_bid_id: string };
        Returns: Database['public']['Tables']['rides']['Row'];
      };
      validate_promo: {
        Args: {
          p_code: string;
          p_context: string;
          p_market_id: string;
          p_zone_id?: string | null;
          p_subtotal_minor?: number;
        };
        Returns: Record<string, unknown>[];
      };
      create_or_attach_merge_batch: {
        Args: { p_order_id: string };
        Returns: Record<string, unknown>;
      };
      apply_city_pricing_template: {
        Args: {
          p_template_code: string;
          p_market_name: string;
          p_slug: string;
          p_country_code: string;
          p_lng: number;
          p_lat: number;
          p_timezone?: string;
        };
        Returns: string;
      };
      track_ride_by_token: {
        Args: { p_token: string };
        Returns: Json;
      };
      track_order_by_token: {
        Args: { p_token: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
