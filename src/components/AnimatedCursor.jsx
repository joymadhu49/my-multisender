import React, { memo } from 'react';

const AnimatedCursor = memo(({ mousePosition, trails }) => {
  // Skip on touch devices
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    return null;
  }

  return (
    <>
      {/* Main cursor */}
      <div 
        className="custom-cursor"
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`
        }}
      />
      <div 
        className="cursor-dot"
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`
        }}
      />
      <div 
        className="cursor-glow"
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`
        }}
      />
      
      {/* Trails */}
      {trails.map((trail, index) => (
        <div
          key={trail.id}
          className="cursor-trail"
          style={{
            left: `${trail.x}px`,
            top: `${trail.y}px`,
            opacity: (index + 1) / trails.length * 0.5,
            transform: `scale(${1 - (trails.length - index) * 0.1})`
          }}
        />
      ))}
    </>
  );
});

AnimatedCursor.displayName = 'AnimatedCursor';

export default AnimatedCursor;