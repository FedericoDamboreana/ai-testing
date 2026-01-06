import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from "wouter";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [location, setLocation] = useLocation();

    useEffect(() => {
        // Init auth from storage
        const token = localStorage.getItem('token');
        if (token) {
            fetchUser(token);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUser = async (token) => {
        try {
            const res = await fetch('/api/v1/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
                return true;
            } else {
                logout(); // Invalid token
                return false;
            }
        } catch (e) {
            console.error(e);
            logout();
            return false;
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        setLoading(true); // Start loading to block redirects
        try {
            const formData = new FormData();
            formData.append('username', email);
            formData.append('password', password);

            const res = await fetch('/api/v1/auth/login', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Login failed');
            }

            const data = await res.json();
            localStorage.setItem('token', data.access_token);
            const success = await fetchUser(data.access_token); // This will set loading=false
            if (!success) {
                throw new Error('Login failed: Unable to fetch user profile.');
            }
            return true;
        } catch (e) {
            setLoading(false); // Reset loading if we fail before fetchUser
            throw e;
        }
    };

    const register = async (email, password, fullName) => {
        const res = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, full_name: fullName })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Registration failed');
        }

        // Auto login after register
        await login(email, password);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        setLocation('/login');
    };

    const getToken = () => localStorage.getItem('token');

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading, getToken }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);

// Fetch wrapper that injects token
export const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });

    // Handle 401 globally if needed (requires access to logout, maybe harder here)
    if (res.status === 401) {
        // trigger logout via event or assume component handles it
        // Or simply:
        // window.location.href = '/login'; 
    }

    return res;
};
