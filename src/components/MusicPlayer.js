'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { animate } from 'animejs';

export default function MusicPlayer() {
  const pathname = usePathname();
  const isAdmin = pathname ? (pathname === '/admin' || pathname.startsWith('/admin/')) : false;

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const audioRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    // Completely disable and teardown music on all admin pages
    if (isAdmin) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      return;
    }

    // Create audio element for public pages
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.4;
    audio.src = '/audio/photograph.mp3';
    audioRef.current = audio;

    // Attempt to play immediately (may be blocked by browser policies)
    const playPromise = audio.play();
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
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
      cleanupInteractionListeners();
    };

    const cleanupInteractionListeners = () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    // Coordinate with video player events
    const handlePauseMusic = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    const handlePlayMusic = () => {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
    };

    window.addEventListener('pause-bg-music', handlePauseMusic);
    window.addEventListener('play-bg-music', handlePlayMusic);

    return () => {
      cleanupInteractionListeners();
      window.removeEventListener('pause-bg-music', handlePauseMusic);
      window.removeEventListener('play-bg-music', handlePlayMusic);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [isAdmin]);

  const togglePlay = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }

    if (btnRef.current) {
      animate(btnRef.current, {
        scale: [1, 0.82, 1.12, 1],
        duration: 450,
        ease: 'spring(1, 80, 10, 0)',
      });
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

  // Do not render any player DOM elements on admin pages
  if (isAdmin) {
    return null;
  }

  return (
    <div
      className={`music-player ${
        isPlaying ? 'music-player--playing' : 'music-player--paused'
      }`}
      id="music-player"
    >
      <button
        ref={btnRef}
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
