import { useState, useEffect, useCallback, useRef } from 'react';
import { APP_CONFIG, throttle } from '../config';

export const useMouseAnimation = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [trails, setTrails] = useState([]);
  const [cursorVariant, setCursorVariant] = useState('default');
  const magneticRefs = useRef([]);
  const animationFrameRef = useRef();

  // Throttled magnetic effect
  const applyMagneticEffect = useCallback(
    throttle((clientX, clientY) => {
      const buttons = document.querySelectorAll('button, .btn-send, .btn-connect');
      
      buttons.forEach(btn => {
        const rect = btn.getBoundingClientRect();
        const btnX = rect.left + rect.width / 2;
        const btnY = rect.top + rect.height / 2;
        const distance = Math.sqrt(
          Math.pow(clientX - btnX, 2) + Math.pow(clientY - btnY, 2)
        );
        
        if (distance < APP_CONFIG.MAGNETIC_BUTTON_DISTANCE) {
          const angle = Math.atan2(clientY - btnY, clientX - btnX);
          const pull = (APP_CONFIG.MAGNETIC_BUTTON_DISTANCE - distance) / 
                       APP_CONFIG.MAGNETIC_BUTTON_DISTANCE;
          const translateX = Math.cos(angle) * pull * APP_CONFIG.MAGNETIC_PULL_STRENGTH;
          const translateY = Math.sin(angle) * pull * APP_CONFIG.MAGNETIC_PULL_STRENGTH;
          
          btn.style.transform = `translate(${translateX}px, ${translateY}px)`;
          btn.style.transition = 'transform 0.1s ease-out';
        } else {
          btn.style.transform = 'translate(0, 0)';
        }
      });
    }, 50), // Throttle to 20fps
    []
  );

  // Optimized mouse move handler
  const handleMouseMove = useCallback((e) => {
    // Cancel previous animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Use requestAnimationFrame for smooth animations
    animationFrameRef.current = requestAnimationFrame(() => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      
      // Create trail effect with cleanup
      const newTrail = {
        id: Date.now() + Math.random(),
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now()
      };
      
      setTrails(prev => {
        // Keep only recent trails
        const filtered = prev.filter(
          trail => Date.now() - trail.timestamp < APP_CONFIG.MOUSE_TRAIL_TIMEOUT
        );
        return [...filtered, newTrail].slice(-APP_CONFIG.MOUSE_TRAIL_COUNT);
      });
      
      // Apply magnetic effect (throttled)
      applyMagneticEffect(e.clientX, e.clientY);
    });
  }, [applyMagneticEffect]);

  // Cleanup on unmount
  useEffect(() => {
    // Check if device supports mouse
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return; // Skip mouse animations on touch devices
    
    window.addEventListener('mousemove', handleMouseMove);
    
    // Cleanup trails periodically
    const cleanupInterval = setInterval(() => {
      setTrails(prev => 
        prev.filter(trail => 
          Date.now() - trail.timestamp < APP_CONFIG.MOUSE_TRAIL_TIMEOUT
        )
      );
    }, 1000);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(cleanupInterval);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Reset all button transforms
      const buttons = document.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.style.transform = 'translate(0, 0)';
      });
    };
  }, [handleMouseMove]);

  return {
    mousePosition,
    trails,
    cursorVariant,
    setCursorVariant
  };
};