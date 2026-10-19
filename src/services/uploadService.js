import apiClient from './apiClient';

const RESPONSE_KEY = { photo: 'photoUrl', document: 'documentUrl', video: 'videoUrl' };

const uploadService = {
  /**
   * Upload one file to `/upload-files` and return its URL.
   * @param {File} file
   * @param {'photo'|'document'|'video'} field - multipart field the backend expects
   */
  async upload(file, field) {
    const body = new FormData();
    body.append(field, file);
    // Let the browser set the multipart boundary; the client default is JSON.
    const { data } = await apiClient.post('/upload-files', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return data[RESPONSE_KEY[field]] || null;
  },
};

export default uploadService;
