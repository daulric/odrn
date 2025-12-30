import Constants from 'expo-constants';

import type { CallSignalType } from './types';

type RNWebRTC = typeof import('react-native-webrtc');

export type WebRTCIceConfig = {
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
};

export type WebRTCCallParams = {
  callId: string;
  localUserId: string;
  remoteUserId: string;
  isCaller: boolean;
  ice?: WebRTCIceConfig;
  sendSignal: (type: CallSignalType, payload: any) => Promise<void>;
  onLocalStream?: (stream: any | null) => void;
  onRemoteStream?: (stream: any | null) => void;
  onConnectionStateChange?: (state: string) => void;
  onError?: (err: unknown) => void;
};

export class WebRTCCallSession {
  private readonly params: WebRTCCallParams;
  private pc: any | null = null;
  private localStream: any | null = null;
  private remoteStream: any | null = null;
  private starting = false;
  private webrtc: RNWebRTC | null = null;

  constructor(params: WebRTCCallParams) {
    this.params = params;
  }

  getPeerConnection() {
    return this.pc;
  }

  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  async start(params?: { withVideo?: boolean }) {
    if (this.starting) return;
    this.starting = true;
    try {
      this.assertSupported();
      await this.ensurePeerConnection();
      await this.ensureLocalMedia({ withVideo: !!params?.withVideo });

      if (this.params.isCaller) {
        await this.createAndSendOffer('offer');
      }
    } catch (err) {
      this.params.onError?.(err);
      throw err;
    } finally {
      this.starting = false;
    }
  }

  async setMicEnabled(enabled: boolean) {
    if (!this.localStream) return;
    const audioTracks = this.localStream.getAudioTracks?.() ?? [];
    audioTracks.forEach((t: any) => (t.enabled = enabled));
  }

  async setVideoEnabled(enabled: boolean) {
    if (enabled) {
      await this.enableVideoTrack();
    } else {
      await this.disableVideoTrack();
    }
  }

  async handleRemoteSignal(type: CallSignalType, payload: any) {
    try {
      this.assertSupported();
      if (type === 'offer' || type === 'renegotiate') {
        await this.handleOfferLike(payload);
        return;
      }
      if (type === 'answer') {
        await this.handleAnswer(payload);
        return;
      }
      if (type === 'ice') {
        await this.handleIce(payload);
        return;
      }
      if (type === 'hangup') {
        await this.hangup();
        return;
      }
      // control: ignore for now (UI may handle)
    } catch (err) {
      this.params.onError?.(err);
      throw err;
    }
  }

  async hangup() {
    try {
      this.pc?.close();
    } catch {
      // ignore
    }

    this.pc = null;

    if (this.localStream) {
      try {
        const tracks = this.localStream.getTracks?.() ?? [];
        tracks.forEach((t: any) => t.stop?.());
      } catch {
        // ignore
      }
    }

    this.localStream = null;
    this.params.onLocalStream?.(null);

    this.remoteStream = null;
    this.params.onRemoteStream?.(null);
  }

  private async ensurePeerConnection() {
    if (this.pc) return;

    const { RTCPeerConnection } = this.getWebRTC();
    const pc: any = new RTCPeerConnection({
      iceServers: this.params.ice?.iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }],
    } as any);

    pc.onicecandidate = (event: any) => {
      if (event?.candidate) {
        void this.params.sendSignal('ice', { candidate: event.candidate });
      }
    };

    pc.ontrack = (event: any) => {
      const stream = event?.streams?.[0];
      if (stream) {
        this.remoteStream = stream;
        this.params.onRemoteStream?.(stream);
      }
    };

    pc.onconnectionstatechange = () => {
      this.params.onConnectionStateChange?.(pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      // Some RN builds still rely on iceConnectionState for reliability.
      this.params.onConnectionStateChange?.(pc.iceConnectionState);
    };

    this.pc = pc;
  }

  private async ensureLocalMedia(params: { withVideo: boolean }) {
    if (this.localStream) {
      if (params.withVideo) await this.enableVideoTrack();
      return;
    }

    const { mediaDevices } = this.getWebRTC();
    const constraints: any = {
      audio: true,
      video: params.withVideo ? { facingMode: 'user' } : false,
    };

    const stream = await mediaDevices.getUserMedia(constraints);
    this.localStream = stream;
    this.params.onLocalStream?.(stream);

    const pc = this.pc!;
    const tracks = stream.getTracks?.() ?? [];
    tracks.forEach((track: any) => {
      pc.addTrack(track, stream);
    });
  }

  private async createAndSendOffer(signalType: 'offer' | 'renegotiate') {
    const pc = this.pc!;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.params.sendSignal(signalType, { sdp: pc.localDescription });
  }

  private async handleOfferLike(payload: any) {
    await this.ensurePeerConnection();
    await this.ensureLocalMedia({ withVideo: false }); // callee starts audio-first; video can be enabled after accept

    const pc = this.pc!;
    const sdp = payload?.sdp;
    if (!sdp) throw new Error('Missing SDP in offer');

    const { RTCSessionDescription } = this.getWebRTC();
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.params.sendSignal('answer', { sdp: pc.localDescription });
  }

  private async handleAnswer(payload: any) {
    const pc = this.pc;
    if (!pc) return;

    const sdp = payload?.sdp;
    if (!sdp) throw new Error('Missing SDP in answer');

    const { RTCSessionDescription } = this.getWebRTC();
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  private async handleIce(payload: any) {
    const pc = this.pc;
    if (!pc) return;

    const cand = payload?.candidate;
    if (!cand) return;
    const { RTCIceCandidate } = this.getWebRTC();
    await pc.addIceCandidate(new RTCIceCandidate(cand));
  }

  private async enableVideoTrack() {
    await this.ensurePeerConnection();
    if (!this.localStream) {
      await this.ensureLocalMedia({ withVideo: true });
      // If caller and already in a call, we need renegotiation.
      if (this.params.isCaller) {
        await this.createAndSendOffer('renegotiate');
      }
      return;
    }

    const existing = this.localStream.getVideoTracks?.()?.[0];
    if (existing) {
      existing.enabled = true;
      return;
    }

    const { mediaDevices } = this.getWebRTC();
    const videoStream = await mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } } as any);
    const track = videoStream.getVideoTracks?.()?.[0];
    if (!track) return;

    // Keep localStream as the single source of tracks for the UI.
    this.localStream.addTrack?.(track);
    this.params.onLocalStream?.(this.localStream);

    this.pc!.addTrack(track, this.localStream);
    await this.createAndSendOffer('renegotiate');
  }

  private async disableVideoTrack() {
    if (!this.localStream) return;

    const track = this.localStream.getVideoTracks?.()?.[0];
    if (!track) return;

    track.enabled = false;

    // Best-effort remove track from peer connection (implementation varies across platforms).
    try {
      const pc: any = this.pc;
      const senders = pc?.getSenders?.() ?? [];
      const sender = senders.find((s: any) => s?.track?.kind === 'video');
      if (sender?.replaceTrack) {
        await sender.replaceTrack(null);
      }
    } catch {
      // ignore
    }

    try {
      track.stop?.();
    } catch {
      // ignore
    }

    try {
      this.localStream.removeTrack?.(track);
    } catch {
      // ignore
    }

    this.params.onLocalStream?.(this.localStream);

    // Renegotiate to stop sending video.
    if (this.pc) {
      await this.createAndSendOffer('renegotiate');
    }
  }

  private assertSupported() {
    // Expo Go doesn't ship custom native modules like react-native-webrtc.
    if ((Constants as any).appOwnership === 'expo') {
      throw new Error('WebRTC is not available in Expo Go. Please use a development build (expo run:ios/android).');
    }
  }

  private getWebRTC(): RNWebRTC {
    if (this.webrtc) return this.webrtc;
    // Lazy require to avoid crashing the whole app in Expo Go at import time.
    // (In Expo Go, the native module is missing.)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-webrtc') as RNWebRTC;
    this.webrtc = mod;
    return mod;
  }
}


