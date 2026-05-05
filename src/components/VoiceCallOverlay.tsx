import { useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import type { CallMedia } from '../contexts/CallContext';

type Props = {
  visible: boolean;
  state: 'idle' | 'incoming' | 'calling' | 'live';
  media: CallMedia;
  remoteLabel: string;
  remoteAvatar: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  errorLine: string | null;
  isMicMuted: boolean;
  isCameraOff: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
};

export default function VoiceCallOverlay({
  visible,
  state,
  media,
  remoteLabel,
  remoteAvatar,
  localStream,
  remoteStream,
  errorLine,
  isMicMuted,
  isCameraOff,
  onAccept,
  onDecline,
  onHangup,
  onToggleMic,
  onToggleCamera,
}: Props) {
  const isVideo = media === 'video';
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el || isVideo) return;
    el.srcObject = remoteStream ?? null;
    void el.play().catch(() => null);
    return () => {
      el.srcObject = null;
    };
  }, [remoteStream, visible, isVideo]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    el.srcObject = remoteStream ?? null;
    void el.play().catch(() => null);
    return () => {
      el.srcObject = null;
    };
  }, [remoteStream, visible]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    el.srcObject = localStream ?? null;
    void el.play().catch(() => null);
    return () => {
      el.srcObject = null;
    };
  }, [localStream, visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/14 bg-gradient-to-br from-slate-900 via-slate-900 to-black">
        {isVideo && (
          <div className="relative aspect-video bg-black">
            <video ref={remoteVideoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline />
            {!remoteStream?.getVideoTracks()?.length ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-200 bg-slate-900/70">
                <p className="text-lg font-semibold">{remoteLabel}</p>
                <p className="text-sm mt-2 text-slate-400">{state === 'calling' ? 'Ringing…' : 'Connecting…'}</p>
              </div>
            ) : null}
            <div className="absolute bottom-4 right-4 w-[30%] min-w-[100px] max-w-[148px] aspect-video rounded-2xl overflow-hidden border border-white/25 shadow-xl bg-black/80">
              <video ref={localVideoRef} className="w-full h-full object-cover" muted autoPlay playsInline />
            </div>
          </div>
        )}

        {!isVideo && (
          <div className="px-10 pt-14 pb-8 text-center text-white relative">
            <audio ref={remoteAudioRef} className="sr-only" autoPlay playsInline />
            <div className="mx-auto mb-8 w-[100px] h-[100px] rounded-full overflow-hidden border-4 border-white/20 shadow-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
              {remoteAvatar ? (
                <img src={remoteAvatar} alt={remoteLabel} className="w-full h-full object-cover" />
              ) : (
                <Mic className="text-white" strokeWidth={1.85} size={42} />
              )}
            </div>
            <p className="text-2xl font-bold tracking-tight text-white">{remoteLabel}</p>
            <p className="text-sm mt-3 font-medium text-blue-300/94 animate-pulse">
              {state === 'incoming' ? 'Incoming voice call…' : state === 'calling' ? 'Waiting for pickup…' : 'Connected'}
            </p>
          </div>
        )}

        {errorLine && <p className="text-center px-10 py-4 text-[13px] text-red-300 bg-red-950/60">{errorLine}</p>}

        <footer className="flex flex-wrap gap-8 justify-center items-center pb-12 pt-10 px-8 bg-black/60 border-t border-white/11">
          {state === 'incoming' ? (
            <>
              <button
                type="button"
                onClick={onAccept}
                className="rounded-full px-11 py-[13px] text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-600/43 transition-[transform] active:scale-[0.96]"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={onDecline}
                className="rounded-full px-11 py-[13px] text-sm font-bold bg-white/93 text-slate-900 hover:bg-white flex items-center gap-2 transition-[transform] active:scale-[0.96]"
              >
                <PhoneOff size={17} strokeWidth={2.05} /> Reject
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    isMicMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title={isMicMuted ? 'Unmute' : 'Mute'}
                >
                  {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                {isVideo && (
                  <button
                    type="button"
                    onClick={onToggleCamera}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                    title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                  >
                    {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onHangup}
                className="rounded-full px-14 py-[13px] flex items-center gap-2 font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/52 transition-[transform] active:scale-[0.96]"
              >
                <PhoneOff strokeWidth={2.06} /> End call
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
