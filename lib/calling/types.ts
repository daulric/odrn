export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'missed' | 'ended' | 'cancelled';

export type CallSignalType = 'offer' | 'answer' | 'ice' | 'renegotiate' | 'hangup' | 'control';

export type CallRow = {
  id: string;
  caller_id: string;
  callee_id: string;
  status: CallStatus;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  client_version: string | null;
};

export type CallSignalRow = {
  id: string;
  call_id: string;
  sender_id: string;
  recipient_id: string | null;
  type: CallSignalType;
  payload: any;
  created_at: string;
};

export type IncomingCallEvent = {
  call: CallRow;
};

export type CallStateEvent =
  | { type: 'call_updated'; call: CallRow }
  | { type: 'call_ended'; call: CallRow };

export type SignalEvent = {
  signal: CallSignalRow;
};


