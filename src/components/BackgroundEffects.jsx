import React, { memo, useMemo } from 'react';
import { APP_CONFIG } from '../config';

const BackgroundEffects = memo(({ mousePosition }) => {
  // Memoize star particles to prevent re-creation
  const starParticles = useMemo(() => {
    return Array.from({ length: APP_CONFIG.STAR_PARTICLE_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 5}s`
    }));
  }, []); // Only create once

  return (
    <>
      {/* Background gradients */}
      <div className="bg-gradient"></div>
      <div className="bg-grid"></div>
      <div className="bg-particles"></div>
      
      {/* Animated background */}
      <div className="animated-bg">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
        
        <div className="wave-container">
          <div className="wave wave-1"></div>
        </div>
        
        {/* Star field */}
        <div className="star-field">
          {starParticles.map(star => (
            <div 
              key={star.id}
              className="star-particle"
              style={{
                left: star.left,
                top: star.top,
                animationDelay: star.animationDelay,
                '--mouse-x': `${mousePosition.x}px`,
                '--mouse-y': `${mousePosition.y}px`
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
});

BackgroundEffects.displayName = 'BackgroundEffects';

export default BackgroundEffects;