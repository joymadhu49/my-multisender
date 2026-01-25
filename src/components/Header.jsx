import React, { memo } from 'react';
import NetworkSwitcher from './NetworkSwitcher';
import ThemeToggle from './ThemeToggle';

const Header = memo(({ 
  account, 
  network, 
  theme, 
  toggleTheme, 
  networkConfig,
  showNetworkSwitcher,
  setShowNetworkSwitcher,
  switchNetwork,
  chainId 
}) => {
  return (
    <header className="header">
      <div className="logo">
        <img src="/logo.png" alt="MultiSend" className="logo-img" />
        <span>MultiSend</span>
      </div>
      
      <div className="header-right">
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        
        {account && (
          <>
            <NetworkSwitcher
              network={network}
              networkConfig={networkConfig}
              showNetworkSwitcher={showNetworkSwitcher}
              setShowNetworkSwitcher={setShowNetworkSwitcher}
              switchNetwork={switchNetwork}
              chainId={chainId}
            />
            <div className="wallet-pill">
              <div className="wallet-status"></div>
              <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
            </div>
          </>
        )}
      </div>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;