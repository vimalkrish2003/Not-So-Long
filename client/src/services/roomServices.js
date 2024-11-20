// services/roomServices.js
import api from './apiClient';

const roomServices = {
  async createRoom() {
    try {
      const response = await api.post('/room/create');
      console.log("Created Room Response:",response.data);
      return response.data;
    } catch (error) {
      console.error('Create room error:', error);
      throw this.handleError(error);
    }
  },

  async joinRoom(roomId) {
    try {
      const response = await api.post(`/room/join/${roomId}`);
      return response.data;
    } catch (error) {
      console.error('Join room error:', error);
      throw this.handleError(error);
    }
  },

  async leaveRoom(roomId) {
    try {
      const response = await api.post(`/room/leave/${roomId}`);
      console.log("Leave Room Response:",response.data);
      return response.data;
    } catch (error) {
      console.error('Leave room error:', error);
      throw this.handleError(error);
    }
  },

  handleError(error) {
    if (error.response) {
      // Server responded with error
      return new Error(error.response.data.message || 'Server error');
    }
    if (error.request) {
      // No response received
      return new Error('No response from server');
    }
    // Request setup error
    return new Error('Failed to make request');
  }
};

export default roomServices;