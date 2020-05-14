/**
 * @Author QJ
 * @date 2020--11 11:35
 * @desc index.js
 */
import Vue from 'vue';
import {
  Button,
  Input,
  Message,
  Progress
} from 'view-design'


Vue.component('Button', Button);
Vue.component('Input', Input);
Vue.component('Progress', Progress);
Vue.prototype.$Message = Message;
