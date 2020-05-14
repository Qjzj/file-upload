<template>
  <div id="app">
    <div class="dragBox" ref="dragBox">
      <label class="file-input-label">
        <input @change="handleInputChange" class="file-input" type="file" >
        选择文件
      </label>
      <p v-if="file">{{file.name}}</p>
<!--      <textarea ref="textarea" class="textarea"></textarea>-->
    </div>
    <Button type="primary" @click="sliceUpload">切片上传</Button>
    <Button type="warning" @click="sampleUpload">简单上传</Button>
    <Button type="info" @click="uploadCheck">上传检查</Button>
    <Button type="error" @click="mergeChunks">test Worker</Button>

    <p> <Progress :percent="progress" /></p>
  </div>
</template>

<script>
  import SparkMd5 from 'spark-md5';
  import path from 'path';
  import {fileUpload, fileUploadSample, fileUploadCheck, fileMerge} from "./api";

  const CHUNK_SIZE = 0.3 * 1024 * 1024;   // 0.3M

  export default {
    name: 'App',
    data() {
      return {
        file: null,
        chunks: [],
        hash: '',
        calculateHashProgress: 0,
      }
    },
    computed: {
      progress() {
        if(!this.file) return 0;
        const len = this.file.size;
        const uploadedSize = this.chunks.map(item => {
          return item.size * item.progress
        }).reduce((pre, cur) => pre + cur, 0);

        return Number((uploadedSize / len).toFixed(2) * 100)
      }
    },
    methods: {
      receiveFile(file) {
        this.file = file;
        this.chunks = [];
        this.hash = '';
      },
      handlePaste() {
        /*const textareaEl = this.$refs.textarea;
        textareaEl.addEventListener('paste', e => {
          e.preventDefault();
          console.log(e);
          console.log(e.clipboardData.items);
          console.log(e.clipboardData.files);
        })*/
        const dragBoxEl = this.$refs.dragBox;
        dragBoxEl.addEventListener('paste', e => {
          const file = e.clipboardData.files[0] || e.clipboardData.items[0] && e.clipboardData.items[0].getAsFile();
          console.log(e.clipboardData.files);
          if(!file) return;
          console.log(file);
          this.receiveFile(file);
        })
      },
      handleDrag() {
        const dragEl = this.$refs.dragBox;

        dragEl.addEventListener('dragover', e => {
          dragEl.style.borderColor = '#0ff';
          e.preventDefault();
        });

        dragEl.addEventListener('dragleave', e => {
          dragEl.style.borderColor = '#e8e8e8';
        });

        dragEl.addEventListener('drop', e => {
          e.preventDefault();
          dragEl.style.borderColor = '#e8e8e8';
          const file = e.dataTransfer.files[0];
          if(file) {
            this.receiveFile(file);
          }
        });

      },
      handleInputChange(e) {
        const [file] = e.target.files;
        if(!file) return;
        this.receiveFile(file);
      },
      async sliceUpload() {
        if(!this.file)  return this.$Message.warning('请选择文件');
        const chunks = this.createChunks(this.file);
        // 计算hash
        this.hash = await this.calculateHash();
        const ext = path.extname(this.file.name);
        const {uploaded, uploadedList} = (await fileUploadCheck({ext, hash: this.hash})).data;

        if(uploaded) {
          this.$Message.success('文件秒传成功');
          return null;
        }
        this.chunks = chunks.map((item, index) => {
          const chunkName = `${this.hash}-${index}`;
          return {
            hash: this.hash,
            chunk: item.chunk,
            name: chunkName,
            progress: uploadedList.indexOf(chunkName + ext) > -1 ? 1 : 0,
            size: item.size,
            index
          }
        });


        await this.uploadChunk(uploadedList);
      },
      async uploadCheck() {
        if(!this.file)  return this.$Message.warning('请选择文件');
        // 计算hash值
        const hash = await this.calculateHash();
        const ext = path.extname(this.file.name);

        const params = {hash, ext};
        fileUploadCheck(params).then(data => {
          console.log('检测结果', data);
        })

      },
      async sampleUpload() {
        if(!this.file)  return this.$Message.warning('请选择文件');
        // 计算hash值
        const hash = await this.calculateHash();
        const formData = new FormData();
        formData.append('hash', hash);
        formData.append('file', this.file);
        fileUploadSample(
          formData, {onUploadProgress: this.uploadProgress}).then(data => {
          console.log(data);
        })
      },
      mergeChunks() {
        const chunks = this.createChunks(this.file, CHUNK_SIZE);
        this.calculateHashSample(chunks).then(data => {
          console.log('hash', hash);
        });

      },
      calculateHash() {
        return new Promise(resolve => {
          const fileReader = new FileReader();
          fileReader.readAsBinaryString(this.file);
          fileReader.onload = function(e) {
            const file = e.target['result'];
            const startTime = new Date().getTime();
            const hash = SparkMd5.hashBinary(file);
            const endTime = new Date().getTime();
            console.log('计算Hash时间', (endTime - startTime)/1000 + 's');
            resolve(hash);
          };
        });

      },
      calculateHashSample() {
        return new Promise(resolve => {
          const spark = new SparkMd5.ArrayBuffer();
          const fileReader = new FileReader();
          const file = this.file;
          const len = file.length;
          const part_size = 1024 * 1024;

          const tempChunks = [file.slice(0, part_size)];

          let cur = part_size;

          while(cur < len) {

            if(cur + part_size >= len) {
              // 最后一块切片
              tempChunks.push(file.slice(cur, len))
            }else {
              const start = file.slice(cur, cur + 2);
              const middle = file.slice(cur + part_size / 2, 2);
              const end = file.slice(cur + part_size - 2, cur + part_size);
              tempChunks.push(start);
              tempChunks.push(middle);
              tempChunks.push(end);
            }
            cur += part_size;
          }

          fileReader.readAsArrayBuffer(new Blob(tempChunks));

          fileReader.onload = (e) => {
            spark.append(e.target['result']);
            resolve(spark.end());
          }
        })

      },
      calculateHashWorker(chunks) {
        return new Promise(resolve => {
          const isSupportWorker = typeof Worker !== "undefined";
          if(!isSupportWorker) return console.log('抱歉! 您的浏览器不支持Web Worker');
          const worker = new Worker('/static/worker/spark-md5-worker.js');
          worker.postMessage({chunks});
          worker.onmessage = function (e) {
            const {hash, progress} = e.data;
            this.calculateHashProgress = progress;
            if(hash) {
              resolve(hash);
            }
          }
        })
      },
      createChunks(file, size = CHUNK_SIZE) {

        const length = this.file.size;
        let cur = 0;
        let chunks = [];
        while(cur < length) {
          let chunk = {};
          if(cur + size > length) {
            // 文件剩余部分小于SIZE
            chunk = {
              index: cur,
              chunk: this.file.slice(cur, cur + size),
              size: length - cur,
            };
          }else {
            chunk = {
              chunk: this.file.slice(cur, cur + size),
              size: size,
            };
          }
          cur += size;
          chunks.push(chunk);
        }
        return chunks;
      },
      async uploadChunk(uploadList) {
        const willUploadList = this.chunks.map((item, index) => {
          const form = new FormData();
          const ext = path.extname(this.file.name)
          const name = item.name + ext;
          form.append('chunk', item.chunk);
          form.append('hash', this.hash);
          form.append('chunkname', item.name);
          form.append('ext', ext);

          return {form, index, name, error: 0}
        }).filter(item => {
          return !uploadList.includes(item.name)
        });

        console.log('即将上传的', willUploadList);

        try {
          await this.sendRequest([...willUploadList], 4);
          console.log('上传完毕');
          if(uploadList.length + willUploadList.length === this.chunks.length) {
            await this.mergeFile();
          }

        }catch (e) {

        }
      },
      async sendRequest(list, limit = 4) {
        return new Promise((resolve, reject) => {
          const len = list.length;
          let counter = 0;
          let isStop = false;
          const start = async () => {
            if(isStop) return;

            const task = list.shift();
            // console.log('task', task);
            if(task) {
              const {form, index} = task;
              try {
                await fileUpload(form, {onUploadProgress: e => {
                  this.chunks[index].progress = Number((e.loaded / e.total).toFixed(2));
                  }});

                if(counter === len -1) {
                  resolve();
                }else {
                  counter ++;
                  start();
                }

              }catch (e) {
                if(task.error < 3) {
                  task.error++;
                  list.unshift(task);
                  start();
                }else {
                  isStop = true;
                  reject();
                }
              }

            }


          }

          while (limit--) {
            start();
          }
        })
      },
      async mergeFile() {
        const {hash} = this;
        const ext = path.extname(this.file.name);
        fileMerge({hash, ext, size: CHUNK_SIZE}).then(data => {
          console.log('上传完成', data);
        })
      },
    },
    mounted() {
      this.handleDrag();
      this.handlePaste();
    }
  }
</script>

<style>
  #app {
    font-family: 'Avenir', Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
    margin-top: 60px;
  }
  .dragBox {
    margin: 20px auto;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 400px;
    height: 250px;
    border: 2px dashed #e8e8e8;
  }
  .textarea {
    width: 200px;
    height: 150px;
  }
  .file-input {
    display: none;
  }
  .file-input-label {
    display: inline-block;
    padding: 5px 10px;
    border: 1px solid #e8e8e8;
    border-radius: 5px;
  }
</style>
