'use client';
import { useState, useEffect, useRef } from 'react';

export default function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const playPromiseRef = useRef(null);

  const safePlay = () => {
    if (audioRef.current) {
      const promise = audioRef.current.play();
      playPromiseRef.current = promise;
      if (promise !== undefined) {
        promise.then(() => setIsPlaying(true)).catch(e => console.log("Autoplay prevented:", e));
      }
    }
  };

  const safePause = () => {
    if (audioRef.current) {
      if (playPromiseRef.current !== undefined && playPromiseRef.current !== null) {
        playPromiseRef.current.then(() => {
          audioRef.current.pause();
          setIsPlaying(false);
        }).catch(() => {});
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5; // Set volume to 50%
      safePlay();
    }

    const handleInteraction = (e) => {
      // If clicking the video facade, do not autoplay background music
      if (e.target.closest && e.target.closest('.video-facade')) {
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
        return;
      }
      
      if (audioRef.current && audioRef.current.paused) {
        safePlay();
      }
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    // Custom events to pause/play music when video plays
    const handlePauseMusic = () => {
      safePause();
      window.sessionStorage.setItem('music-paused-by-video', 'true');
    };
    
    const handlePlayMusic = () => {
      if (window.sessionStorage.getItem('music-paused-by-video') === 'true') {
        safePlay();
        window.sessionStorage.removeItem('music-paused-by-video');
      }
    };

    window.addEventListener('pause-bg-music', handlePauseMusic);
    window.addEventListener('play-bg-music', handlePlayMusic);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('pause-bg-music', handlePauseMusic);
      window.removeEventListener('play-bg-music', handlePlayMusic);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        safePause();
        window.sessionStorage.removeItem('music-paused-by-video'); // User manually paused
      } else {
        safePlay();
      }
    }
  };

  return (
    <>
      <audio 
        ref={audioRef} 
        src="/audio/bg-music.mp3" 
        loop 
        preload="auto"
      />
      
      <button 
        onClick={togglePlay}
        className="audio-toggle-btn"
        aria-label={isPlaying ? "Tạm dừng nhạc nền" : "Phát nhạc nền"}
      >
        {isPlaying ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        )}
      </button>

      <style jsx>{`
        .audio-toggle-btn {
          position: fixed;
          bottom: 20px;
          left: 20px;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: var(--color-glass);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--color-glass-border);
          color: var(--color-text);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 9999;
          box-shadow: var(--shadow-md);
          transition: transform 0.3s ease, background 0.3s ease;
        }
        
        .audio-toggle-btn:hover {
          transform: scale(1.1);
          background: rgba(255, 255, 255, 0.9);
        }

        @media (max-width: 768px) {
          .audio-toggle-btn {
            bottom: 16px;
            left: 16px;
            width: 44px;
            height: 44px;
          }
          .audio-toggle-btn svg {
            width: 20px;
            height: 20px;
          }
        }
      `}</style>
    </>
  );
}
