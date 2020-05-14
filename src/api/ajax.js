import axios from 'axios'


export default function ajax(url = '', params = {}, type = "POST", config = {}) {
  let promise;
  return new Promise((resolve, reject) => {
    if (type === 'GET') {
      //  拼接数据
      let paramsStr = '';
      Object.keys(params).forEach(key => {
        paramsStr += key + '=' + params[key] + '&'
      });
      // 去除最后一个&
      if (paramsStr !== '') {
        paramsStr = paramsStr.substr(0, paramsStr.lastIndexOf('&'));
      }

      // 拼接完整的url
      url += "?" + paramsStr;
      promise = axios.get(url);
    } else if ('POST' === type) {
      // TODO 数据加密

      promise = axios.post(url, params, config);

    } else if (type === 'DELETE') {
      promise = axios.delete(url + params, config);
    }


    promise.then(function (response) {
      // TODO 数据解密

      response && resolve(response['data'])
    }).catch(err => {
      reject(err)
    })
  })
};

