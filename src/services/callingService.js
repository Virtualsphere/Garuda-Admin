import apiClient from './apiClient';

const callingService = {
  async clickToCall({ customerNumber, departmentType, callerName, missionContext, landId }) {
    const { data } = await apiClient.post('/calling/click-to-call', {
      customerNumber,
      departmentType,
      callerName,
      missionContext,
      landId,
    });
    return data;
  },
};

export default callingService;
