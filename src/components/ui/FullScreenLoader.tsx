import React from 'react';

const FullScreenLoader = () => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(255,255,255,0.9)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}
  >
    <div className="relative">
      {/* Outer rotating ring */}
      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />

      {/* Inner pulsing circle */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse" />
      </div>

      {/* Floating dots */}
      <div
        className="absolute -top-2 -right-2 w-3 h-3 bg-green-500 rounded-full animate-bounce"
        style={{ animationDelay: '0s' }}
      />
      <div
        className="absolute -bottom-2 -left-2 w-3 h-3 bg-purple-500 rounded-full animate-bounce"
        style={{ animationDelay: '0.2s' }}
      />
      <div
        className="absolute -top-2 -left-2 w-3 h-3 bg-orange-500 rounded-full animate-bounce"
        style={{ animationDelay: '0.4s' }}
      />
    </div>

    <div className="mt-6 text-center">
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Saving your project</h3>
      <p className="text-gray-600 text-sm">Please wait while we save your changes...</p>

      {/* Progress dots */}
      <div className="flex justify-center mt-4 space-x-1">
        <div
          className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"
          style={{ animationDelay: '0.2s' }}
        />
        <div
          className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"
          style={{ animationDelay: '0.4s' }}
        />
      </div>
    </div>
  </div>
);

export default FullScreenLoader;
