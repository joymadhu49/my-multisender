import React, { memo } from 'react';
import { APP_CONFIG } from '../config';
import NetworkLogos from './NetworkLogos';

const NetworkSwitcher = memo(({ 
  network, 
  networkConfig, 
  showNetworkSwitcher, 
  setShowNetworkSwitcher, 
  switchNetwork,
  chainId 
}) => {
  return (
    <div className="network-switcher">
      <button
        className="network-switcher-btn"
        onClick={() => setShowNetworkSwitcher(!showNetworkSwitcher)}
      >
        <span className="network-btn-logo">
          {networkConfig?.logo && NetworkLogos[networkConfig.logo] ? 
            NetworkLogos[networkConfig.logo] : 
            <span className="network-dot"></span>
          }
        </span>
        <span className="network-name">{network}</span>
        <svg className={`network-chevron ${showNetworkSwitcher ? 'open' : ''}`} 
             viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      
      {showNetworkSwitcher && (
        <>
          <div className="network-switcher-backdrop" 
               onClick={() => setShowNetworkSwitcher(false)}></div>
          <div className="network-switcher-dropdown">
            <div className="network-switcher-title">Switch Network</div>
            {Object.entries(APP_CONFIG.NETWORK_CONFIG).map(([id, config]) => (
              <button
                key={id}
                className={`network-option ${Number(chainId) === Number(id) ? 'active' : ''}`}
                onClick={() => {
                  switchNetwork(Number(id));
                  setShowNetworkSwitcher(false);
                }}
              >
                <span className="network-option-icon">
                  {NetworkLogos[config.logo]}
                </span>
                <span className="network-option-name">{config.name}</span>
                {Number(chainId) === Number(id) && <span className="network-check">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
});

NetworkSwitcher.displayName = 'NetworkSwitcher';

export default NetworkSwitcher;