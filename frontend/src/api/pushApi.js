import { baseApi } from './baseApi';

export const pushApi = {
  getVapidPublicKey: async () => {
    const response = await baseApi.get('/push/vapid-public-key', { _silent: true });
    return response.data.data.publicKey;
  },

  subscribe: async (subscription) => {
    const response = await baseApi.post('/push/subscriptions', subscription);
    return response.data.data;
  },

  unsubscribe: async (endpoint) => {
    const response = await baseApi.delete('/push/subscriptions', {
      data: { endpoint },
      _silent: true,
    });
    return response.data;
  },

  listSubscriptions: async () => {
    const response = await baseApi.get('/push/subscriptions', { _silent: true });
    return response.data.data;
  },
};
