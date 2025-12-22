import { supabase } from '@/lib/supabase';
import type { CallRow, CallSignalRow, CallSignalType, CallStatus } from './types';

type Unsubscribe = () => void;

function normalizeCall(row: any): CallRow {
  return row as CallRow;
}

function normalizeSignal(row: any): CallSignalRow {
  return row as CallSignalRow;
}

export async function createOutgoingCall(params: {
  callerId: string;
  calleeId: string;
  clientVersion?: string;
}): Promise<CallRow> {
  const { callerId, calleeId, clientVersion } = params;

  const { data, error } = await (supabase as any)
    .from('calls')
    .insert({
      caller_id: callerId,
      callee_id: calleeId,
      status: 'ringing',
      client_version: clientVersion ?? null,
    })
    .select('*')
    .single();

  if (!error) return normalizeCall(data);

  // If there's already an active call between these two users, return it instead of failing.
  // This is enforced by the partial unique index: calls_unique_active_pair_idx.
  if ((error as any)?.code === '23505') {
    const { data: existing, error: existingError } = await supabase
      .from('calls')
      .select('*')
      .or(`and(caller_id.eq.${callerId},callee_id.eq.${calleeId}),and(caller_id.eq.${calleeId},callee_id.eq.${callerId})`)
      .in('status', ['ringing', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingError && existing) return normalizeCall(existing);
  }

  throw error;
}

export async function getCall(callId: string): Promise<CallRow> {
  const { data, error } = await supabase.from('calls').select('*').eq('id', callId).single();
  if (error) throw error;
  return normalizeCall(data);
}

export async function updateCallStatus(params: {
  callId: string;
  status: CallStatus;
  endReason?: string | null;
}): Promise<CallRow> {
  const { callId, status, endReason } = params;

  const update: any = { status };
  if (typeof endReason !== 'undefined') update.end_reason = endReason;

  const { data, error } = await (supabase as any)
    .from('calls')
    .update(update)
    .eq('id', callId)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeCall(data);
}

export async function acceptCall(callId: string): Promise<CallRow> {
  return updateCallStatus({ callId, status: 'accepted' });
}

export async function declineCall(callId: string): Promise<CallRow> {
  return updateCallStatus({ callId, status: 'declined' });
}

export async function cancelCall(callId: string): Promise<CallRow> {
  return updateCallStatus({ callId, status: 'cancelled' });
}

export async function endCall(callId: string, endReason?: string): Promise<CallRow> {
  return updateCallStatus({ callId, status: 'ended', endReason: endReason ?? null });
}

export async function sendSignal(params: {
  callId: string;
  senderId: string;
  recipientId?: string | null;
  type: CallSignalType;
  payload: any;
}): Promise<CallSignalRow> {
  const { callId, senderId, recipientId, type, payload } = params;

  const { data, error } = await (supabase as any)
    .from('call_signals')
    .insert({
      call_id: callId,
      sender_id: senderId,
      recipient_id: typeof recipientId === 'undefined' ? null : recipientId,
      type,
      payload,
    })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeSignal(data);
}

export function subscribeToIncomingCalls(params: {
  userId: string;
  onIncoming: (call: CallRow) => void;
  onUpdate?: (call: CallRow) => void;
}): Unsubscribe {
  const { userId, onIncoming, onUpdate } = params;

  const channel = supabase
    .channel(`incoming-calls:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'ordn', table: 'calls', filter: `callee_id=eq.${userId}` },
      (payload) => {
        const call = normalizeCall((payload as any).new);
        if (call.status === 'ringing') onIncoming(call);
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'ordn', table: 'calls', filter: `callee_id=eq.${userId}` },
      (payload) => {
        const call = normalizeCall((payload as any).new);
        onUpdate?.(call);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToCall(params: {
  callId: string;
  onUpdate: (call: CallRow) => void;
}): Unsubscribe {
  const { callId, onUpdate } = params;

  const channel = supabase
    .channel(`call:${callId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'ordn', table: 'calls', filter: `id=eq.${callId}` },
      (payload) => {
        const call = normalizeCall((payload as any).new);
        onUpdate(call);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToSignals(params: {
  callId: string;
  onSignal: (signal: CallSignalRow) => void;
}): Unsubscribe {
  const { callId, onSignal } = params;

  const channel = supabase
    .channel(`call-signals:${callId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'ordn', table: 'call_signals', filter: `call_id=eq.${callId}` },
      (payload) => {
        const signal = normalizeSignal((payload as any).new);
        onSignal(signal);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function isTerminalStatus(status: CallStatus): boolean {
  return status === 'declined' || status === 'missed' || status === 'ended' || status === 'cancelled';
}


