'use client';

import { useState, useRef, useEffect } from 'react';

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Create audio element on mount
    audioRef.current = new Audio();
    audioRef.current.loop = true;
    audioRef.current.volume = 0.4;
    audioRef.current.src = '/audio/photograph.mp3';

    // Attempt to play immediately (may be blocked by browser policies)
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay was prevented. We rely on the interaction listener below.
          console.log("Autoplay blocked. Waiting for user interaction.");
        });
    }

    // Auto play on user interaction if possible
    const handleInteraction = () => {
      if (audioRef.current && audioRef.current.paused && !isPlaying) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch((e) => {
            console.error(e);
            alert("Vui lòng đảm bảo bạn đã thêm file photograph.mp3 vào thư mục public/audio/");
          });
      }
    }
  };

  return (
    <div
      className={`music-player ${
        isPlaying ? 'music-player--playing' : 'music-player--paused'
      }`}
      id="music-player"
    >
      <button
        className="music-player__btn"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause music' : 'Play music'}
        title={isPlaying ? 'Pause music' : 'Play music'}
      >
        <span className="music-player__bar music-player__bar--1" />
        <span className="music-player__bar music-player__bar--2" />
        <span className="music-player__bar music-player__bar--3" />
        <span className="music-player__bar music-player__bar--4" />
      </button>
    </div>
  );
}
