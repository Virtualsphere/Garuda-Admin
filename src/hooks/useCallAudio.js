import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * One call recording at a time.
 *
 * Starting a second recording stops the first, and leaving the page stops
 * whatever is playing — an `Audio` object keeps playing after its component has
 * unmounted unless something pauses it.
 *
 * `playingId` is whatever key the caller passes to `toggle`, so a table of
 * recordings can highlight the row that is audible.
 */
export default function useCallAudio() {
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const toggle = useCallback(
    (id, url) => {
      if (!url) return;
      if (playingId !== null && String(playingId) === String(id)) {
        stop();
        return;
      }
      stop();

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      // A recording URL that is dead or blocked should end the "playing" state,
      // not leave the button stuck on Pause.
      audio.onerror = () => setPlayingId(null);
      audio.play().catch(() => setPlayingId(null));
      setPlayingId(id);
    },
    [playingId, stop]
  );

  useEffect(() => stop, [stop]);

  return { playingId, toggle, stop };
}
