import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { removeChannelSafe } from '../lib/realtime';
import { useAuth } from './AuthContext';
import VoiceCallOverlay from '../components/VoiceCallOverlay';

export type CallMedia = 'audio' | 'video';

type RingPayload = {
  callId: string;
  conversationId: string;
  fromUserId: string;
  fromName: string;
  fromAvatar?: string | null;
  media: CallMedia;
  offer: RTCSessionDescriptionInit;
};

type SigPayload =
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; candidate: RTCIceCandidateInit; fromCaller: boolean }
  | { type: 'hangup' };

type CallContextValue = {
  startCall: (args: {
    calleeId: string;
    calleeName?: string | null;
    calleeAvatar?: string | null;
    conversationId: string;
    media: CallMedia;
  }) => Promise<void>;
  declineIncoming: () => void;
  acceptIncoming: () => Promise<void>;
  endCall: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  isMicMuted: boolean;
  isCameraOff: boolean;
};

const CallContext = createContext<CallContextValue | null>(null);

const STUN: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function waitSubscribed(ch: ReturnType<typeof supabase.channel>) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Signaling timed out')), 16000);
    ch.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        window.clearTimeout(timer);
        resolve();
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        window.clearTimeout(timer);
        reject(err ?? new Error(String(status)));
      }
    });
  });
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [incoming, setIncoming] = useState<RingPayload | null>(null);
  const [uiState, setUiState] = useState<'idle' | 'calling' | 'incoming' | 'live'>('idle');
  const [media, setMedia] = useState<CallMedia>('audio');
  const [remoteLabel, setRemoteLabel] = useState('');
  const [remoteAvatar, setRemoteAvatar] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sigRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callIdRef = useRef<string | null>(null);
  /** Guard against duplicate ring overlays */
  const busyRef = useRef(false);
  /** Tracks local stream for teardown (state updates are async) */
  const localStreamRefSync = useRef<MediaStream | null>(null);

  const cleanupPc = () => {
    pcRef.current?.close();
    pcRef.current = null;
  };

  const cleanupSig = () => {
    if (sigRef.current) {
      removeChannelSafe(supabase, sigRef.current);
      sigRef.current = null;
    }
  };

  const teardown = useCallback(() => {
    cleanupPc();
    cleanupSig();
    setIsMicMuted(false);
    setIsCameraOff(false);
    localStreamRefSync.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /**/
      }
    });
    localStreamRefSync.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    callIdRef.current = null;
    busyRef.current = false;
    setIncoming(null);
    setUiState('idle');
    setErrorLine(null);
    setRemoteLabel('');
    setRemoteAvatar(null);
  }, []);

  const toggleMic = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  }, [localStream]);

  useEffect(() => {
    localStreamRefSync.current = localStream;
  }, [localStream]);

  useEffect(
    () => () => {
      cleanupPc();
      cleanupSig();
      localStreamRefSync.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /**/
        }
      });
    },
    [],
  );

  /** Personal ring channel */
  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase.channel(`incoming-ring:${profile.id}`, { config: { broadcast: { ack: false } } });
    ch.on('broadcast', { event: 'ring' }, ({ payload }) => {
      const ring = payload as RingPayload | undefined;
      if (!ring?.callId || !ring.offer) return;
      if (busyRef.current || callIdRef.current) {
        toast('Busy — another call ignored');
        return;
      }
      setIncoming(ring);
      setRemoteLabel(ring.fromName);
      setRemoteAvatar(ring.fromAvatar || null);
      setUiState('incoming');
    });
    void ch.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') console.error('incoming-ring:', err);
    });
    return () => removeChannelSafe(supabase, ch);
  }, [profile?.id]);

  const teardownRef = useRef(teardown);
  teardownRef.current = teardown;

  const wireSig = (pc: RTCPeerConnection, sigCh: ReturnType<typeof supabase.channel>, amCaller: boolean) => {
    sigCh.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      try {
        const p = payload as SigPayload;
        if (p?.type === 'answer' && amCaller) {
          await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
        }
        if (p?.type === 'ice' && p.candidate) {
          const ok = amCaller ? !p.fromCaller : p.fromCaller;
          if (ok) await pc.addIceCandidate(new RTCIceCandidate(p.candidate));
        }
        if (p?.type === 'hangup') {
          toast('Call ended', { duration: 2200 });
          busyRef.current = false;
          teardownRef.current();
        }
      } catch (e) {
        console.error('webrtc signal parse', e);
      }
    });
  };

  const endCall = useCallback(async () => {
    const ch = sigRef.current;
    const cid = callIdRef.current;
    if (ch && cid) {
      try {
        await ch.send({ type: 'broadcast', event: 'signal', payload: { type: 'hangup' } satisfies SigPayload });
      } catch {
        /**/
      }
    }
    teardown();
  }, [teardown]);

  const declineIncoming = useCallback(() => {
    if (incoming?.callId) {
      const ch = supabase.channel(`webrtc-sig:${incoming.callId}`, { config: { broadcast: { ack: false } } });
      void ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void ch.send({ type: 'broadcast', event: 'signal', payload: { type: 'hangup' } });
        }
        window.setTimeout(() => removeChannelSafe(supabase, ch), 400);
      });
    }
    setIncoming(null);
    setUiState('idle');
  }, [incoming]);

  const startCall = useCallback(
    async (args: { calleeId: string; calleeName?: string | null; calleeAvatar?: string | null; conversationId: string; media: CallMedia }) => {
      if (!profile) {
        toast.error('Sign in required');
        return;
      }
      if (busyRef.current) {
        toast.error('Already in a call');
        return;
      }
      busyRef.current = true;
      const callId = crypto.randomUUID();
      callIdRef.current = callId;
      setMedia(args.media);
      setRemoteLabel(args.calleeName?.trim() || 'Contact');
      setRemoteAvatar(args.calleeAvatar || null);
      setUiState('calling');
      setErrorLine(null);

      try {
        const pc = new RTCPeerConnection(STUN);
        pcRef.current = pc;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: args.media === 'video',
        });
        setLocalStream(stream);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.ontrack = (ev) => {
          if (ev.streams[0]) setRemoteStream(ev.streams[0]);
          setUiState('live');
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sigCh = supabase.channel(`webrtc-sig:${callId}`, { config: { broadcast: { ack: false } } });
        sigRef.current = sigCh;
        wireSig(pc, sigCh, true);

        pc.onicecandidate = (ev) => {
          if (!ev.candidate || !sigRef.current) return;
          void sigRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'ice', candidate: ev.candidate.toJSON(), fromCaller: true },
          });
        };

        await waitSubscribed(sigCh);

        const ringCh = supabase.channel(`incoming-ring:${args.calleeId}`, { config: { broadcast: { ack: false } } });
        await waitSubscribed(ringCh);
        const status = await ringCh.send({
          type: 'broadcast',
          event: 'ring',
          payload: {
            callId,
            conversationId: args.conversationId,
            fromUserId: profile.id,
            fromName: profile.full_name?.trim() || profile.username || 'NepLink user',
            fromAvatar: profile.avatar_url,
            media: args.media,
            offer: pc.localDescription?.toJSON() ?? offer,
          } satisfies RingPayload,
        });
        removeChannelSafe(supabase, ringCh);
        if (status !== 'ok') throw new Error(`Failed to send ring: ${status}`);

        toast.success('Ringing…');
      } catch (e) {
        console.error('startCall', e);
        const msg = e instanceof Error ? e.message : 'Call failed';
        setErrorLine(msg);
        toast.error(msg);
        busyRef.current = false;
        teardown();
      }
    },
    [profile, teardown],
  );

  const acceptIncoming = useCallback(async () => {
    if (!profile || !incoming) return;
    const ring = { ...incoming };
    busyRef.current = true;
    callIdRef.current = ring.callId;
    setMedia(ring.media);
    setRemoteLabel(ring.fromName);
    setRemoteAvatar(ring.fromAvatar || null);
    setUiState('live');
    setErrorLine(null);
    setIncoming(null);

    try {
      const pc = new RTCPeerConnection(STUN);
      pcRef.current = pc;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: ring.media === 'video',
      });
      setLocalStream(stream);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (ev) => {
        if (ev.streams[0]) setRemoteStream(ev.streams[0]);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(ring.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const sigCh = supabase.channel(`webrtc-sig:${ring.callId}`, { config: { broadcast: { ack: false } } });
      sigRef.current = sigCh;
      wireSig(pc, sigCh, false);

      pc.onicecandidate = (ev) => {
        if (!ev.candidate || !sigRef.current) return;
        void sigRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'ice', candidate: ev.candidate.toJSON(), fromCaller: false },
        });
      };

      await waitSubscribed(sigCh);
      await sigCh.send({
        type: 'broadcast',
        event: 'signal',
        payload: { type: 'answer', sdp: pc.localDescription?.toJSON() ?? answer },
      });
      toast.success('Connected');
    } catch (e) {
      console.error('acceptIncoming', e);
      toast.error(e instanceof Error ? e.message : 'Could not answer');
      busyRef.current = false;
      teardown();
    }
  }, [incoming, profile, teardown]);

  const showIncoming = !!(incoming && uiState === 'incoming');
  const overlayVisible = showIncoming || uiState === 'calling' || uiState === 'live';

  return (
    <CallContext.Provider
      value={{
        startCall,
        declineIncoming,
        acceptIncoming,
        endCall,
        toggleMic,
        toggleCamera,
        isMicMuted,
        isCameraOff,
      }}
    >
      {children}
      {profile && (
        <VoiceCallOverlay
          visible={overlayVisible}
          state={showIncoming ? 'incoming' : uiState === 'calling' ? 'calling' : uiState === 'live' ? 'live' : 'idle'}
          media={media}
          remoteLabel={remoteLabel}
          remoteAvatar={remoteAvatar}
          localStream={localStream}
          remoteStream={remoteStream}
          errorLine={errorLine}
          isMicMuted={isMicMuted}
          isCameraOff={isCameraOff}
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
          onHangup={endCall}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
        />
      )}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
