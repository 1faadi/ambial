'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface RulerContextValue {
  showRulers: boolean;
  toggleRulers: () => void;
  setShowRulers: (show: boolean) => void;
  originX: number;
  originY: number;
  setOrigin: (x: number, y: number) => void;
  resetOrigin: () => void;
}

const RulerContext = createContext<RulerContextValue | undefined>(undefined);

export const useRuler = () => {
  const context = useContext(RulerContext);
  if (context === undefined) {
    throw new Error('useRuler must be used within a RulerProvider');
  }
  return context;
};

export const RulerProvider = ({ children }: { children: ReactNode }) => {
  const [showRulers, setShowRulers] = useState(true);
  const [originX, setOriginX] = useState(0);
  const [originY, setOriginY] = useState(0);

  const toggleRulers = () => {
    setShowRulers(prev => !prev);
  };

  const value: RulerContextValue = {
    showRulers,
    toggleRulers,
    setShowRulers,
    originX,
    originY,
    setOrigin: (x: number, y: number) => {
      setOriginX(x);
      setOriginY(y);
    },
    resetOrigin: () => {
      setOriginX(0);
      setOriginY(0);
    },
  };

  return <RulerContext.Provider value={value}>{children}</RulerContext.Provider>;
};
