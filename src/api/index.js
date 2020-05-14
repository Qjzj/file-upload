import ajax from './ajax'

let baseUrl = '/api';

export const fileUpload = (formData, config={}) => ajax(baseUrl + '/upload/chunk', formData, "POST", config);

export const fileUploadSample = (formData, config = {}) => ajax(baseUrl + '/upload/sample', formData, 'POST', config);

export const fileUploadCheck = data => ajax(baseUrl + '/upload/check', data);

export const fileMerge = data => ajax(baseUrl + "/upload/merge", data);
