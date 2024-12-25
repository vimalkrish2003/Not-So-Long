import api from './apiClient';

const roomServices = {
  async createRoom() {
    try {
      // Only handle HTTP request for room creation
      const response = await api.post('/room/create');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  async joinRoom(roomId) {
    try {
      // Only handle HTTP request for room joining
      const response = await api.post(`/room/join/${roomId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  async leaveRoom(roomId) {
    try {
      // Only handle HTTP request for room leaving
      const response = await api.post(`/room/leave/${roomId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  },

  handleError(error) {
    if (error.response?.status === 404) {
      return new Error('Room not found');
    }
    if (error.response?.status === 403) {
      return new Error('Not authorized to access room');
    }
    return new Error(error.response?.data?.message || 'Server error');
  }
};

export default roomServices;