import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export const hrOnboardingApi = {
  createGeneralLabor: async (payload) => {
    const response = await baseApi.post('/hr/onboarding/general-labor', payload);
    return unwrapApiData(response);
  },

  completeProbationOnboarding: async (candidateId, payload) => {
    const response = await baseApi.post(
      `/hr/probation/candidates/${candidateId}/complete-onboarding`,
      payload,
    );
    return unwrapApiData(response);
  },
};
