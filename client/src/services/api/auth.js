import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export const authService={
    async googleLogin(token){
        try{
            const response = await axios.post(`${API_URL}/auth/google`,{token});
            if(response.data.token){
                localStorage.setItem('user',JSON.stringify(response.data));
            }
            return response.data;
        }
        catch(err){
            throw new Error(err.response?.data?.message || "Authentication Failed");
        }
    },
    logout(){
        localStorage.removeItem('user');
    }
}