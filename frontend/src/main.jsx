import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Login from './Login';
import { Icon } from './Identity';
import Workspace from './workspace/Workspace';
import KineticBackground from './motion/KineticBackground';
import { api } from './api';
import './styles.css';

function readTheme() {
  try {
    return localStorage.getItem('forensiq-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
function AuthTransition({ name }) {
  return (
    <div className="access-transition" role="status" aria-live="polite">
      <div className="scan-gate" aria-hidden="true">
        <div className="gate-ring" />
        <Icon name="check" size={42} />
      </div>
      <span className="transition-label">AUTHENTICATION SUCCESSFUL</span>
      <h1>
        Opening the lab<span>.</span>
      </h1>
      <p>{name}</p>
      <div className="entry-progress" />
    </div>
  );
}
function App() {
  const [theme, setTheme] = useState(readTheme);
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [entering, setEntering] = useState(false);
  const [sessionMessage, setMessage] = useState('');
  const timer = useRef();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content =
      getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    try {
      localStorage.setItem('forensiq-theme', theme);
    } catch {
      /* private browsing */
    }
  }, [theme]);
  useEffect(() => {
    const controller = new AbortController();
    const expiry = setTimeout(() => controller.abort(), 7000);
    api('/auth/me', { signal: controller.signal })
      .then(setUser)
      .catch(() => {})
      .finally(() => {
        clearTimeout(expiry);
        setRestoring(false);
      });
    function expire() {
      clearTimeout(timer.current);
      setEntering(false);
      setUser(null);
      setMessage('Your session has ended. Sign in to continue.');
      history.replaceState(null, '', location.pathname);
    }
    window.addEventListener('forensiq:session-ended', expire);
    return () => {
      controller.abort();
      clearTimeout(timer.current);
      clearTimeout(expiry);
      window.removeEventListener('forensiq:session-ended', expire);
    };
  }, []);
  useEffect(() => {
    document.title = user
      ? 'FORENSIQ · Investigation workspace'
      : 'FORENSIQ · Investigator access';
  }, [user]);
  function authenticated(person) {
    setUser(person);
    setEntering(true);
    setMessage('');
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    timer.current = setTimeout(() => setEntering(false), reduced ? 250 : 1400);
  }
  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    history.replaceState(null, '', location.pathname);
    setUser(null);
    setMessage('');
    window.scrollTo(0, 0);
  }
  const themeProps = {
    theme,
    onToggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
  };
  return (
    <>
      <KineticBackground />
      {entering && user ? (
        <AuthTransition name={user.name} />
      ) : user ? (
        <div className="workspace-root">
          <Workspace user={user} onLogout={logout} {...themeProps} />
        </div>
      ) : (
        <Login
          onAuthenticated={authenticated}
          {...themeProps}
          sessionMessage={sessionMessage}
          restoring={restoring}
        />
      )}
    </>
  );
}
createRoot(document.getElementById('root')).render(<App />);
