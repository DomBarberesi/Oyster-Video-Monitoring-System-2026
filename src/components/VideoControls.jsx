import React, { useState, useEffect } from "react";

const REWIND_SECONDS = 3;
const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

const buttonStyle = {
  padding: "6px 12px",
  margin: "0 4px",
  cursor: "pointer",
};

const activeButtonStyle = {
  ...buttonStyle,
  border: "2px solid #4a9eff",
};

const VideoControls = ({ videoRef }) => {
  const [isPaused, setIsPaused] = useState(true);
  const [speed, setSpeed] = useState(1);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePause = () => setIsPaused(true);
        const handlePlay = () => setIsPaused(false);
        const handleEnded = () => setIsPaused(true);

        video.addEventListener("pause", handlePause);
        video.addEventListener("play", handlePlay);
        video.addEventListener("ended", handleEnded);

        return () => {
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("ended", handleEnded);
        };
    }, [videoRef]);


  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play();
    } else {
      video.pause();
    }
  };

  const rewind = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - REWIND_SECONDS);
  };

  const setPlaybackSpeed = (rate) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setSpeed(rate);
  };

  return (
    <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
      <button style={buttonStyle} onClick={rewind}>
        ⏪ -{REWIND_SECONDS}s
      </button>
      <button style={buttonStyle} onClick={togglePlayPause}>
        {isPaused ? "▶️ Play" : "⏸️ Pause"}
      </button>

      <div style={{ marginTop: "0.5rem" }}>
        {SPEED_OPTIONS.map((rate) => (
          <button
            key={rate}
            style={speed === rate ? activeButtonStyle : buttonStyle}
            onClick={() => setPlaybackSpeed(rate)}
          >
            {rate}x
          </button>
        ))}
      </div>
    </div>
  );
};

export default VideoControls;