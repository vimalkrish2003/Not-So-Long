import api from "./apiClient";


export const authService = {
  async googleLogin(token) {
    try {
      const response = await api.post("/auth/google", { token });
      const { token: jwtToken, user } = response.data;

      if (!jwtToken || !user) {
        throw new Error("Invalid response from server");
      }

      // Store token and user data
      localStorage.setItem("token", jwtToken);
      localStorage.setItem("user", JSON.stringify(user));

      return user;
    } catch (err) {
      console.error("Auth service error:", err);
      throw new Error(err.response?.data?.message || "Authentication failed");
    }
  },

  getUser() {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },

  getToken() {
    return localStorage.getItem("token");
  },

  isAuthenticated() {
    const token = this.getToken();
    return Boolean(token && !this.isTokenExpired());
  },

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  // Helper to check if token is expired
  isTokenExpired() {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return Date.now() >= payload.exp * 1000;
    } catch (err) {
      return true;
    }
  },
};

export default authService;
