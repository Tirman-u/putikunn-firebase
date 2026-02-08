
import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '@/lib/firebase'; // Impordin Firebase'i seadistuse
import { onAuthStateChanged, signOut, signInWithRedirect, GoogleAuthProvider } from 'firebase/auth'; // Impordin vajalikud Firebase'i autentimisfunktsioonid

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    // See funktsioon käivitub, kui kasutaja autentimisolek muutub
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthenticated(!!user);
      setIsLoadingAuth(false);
    });

    // Koristame kuulaja ära, kui komponent eemaldatakse
    return () => unsubscribe();
  }, []);

  const logout = () => {
    signOut(auth);
  };

  const navigateToLogin = () => {
    const provider = new GoogleAuthProvider(); // Kasutame Google'i sisselogimist näitena
    signInWithRedirect(auth, provider);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      logout,
      navigateToLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
