import { authService } from "../services/api/auth";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext=createContext(null);

export const AuthProvider=({children})=>{
    const [user,setUser]=useState(null);
    const [isLoading,setIsLoading]=useState(true);
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if(storedUser) {
            const userData = JSON.parse(storedUser);
            setUser(userData.user);
        }
        setIsLoading(false);
    }, []);

    const login=(userData)=>{
        setUser(userData);
    };
    const logout=()=>{
        authService.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{user, login, logout, loading: isLoading}}>
            {!isLoading && children}
        </AuthContext.Provider>
    )
}

export const useAuth=()=>useContext(AuthContext);
