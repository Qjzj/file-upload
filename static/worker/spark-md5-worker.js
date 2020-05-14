/**
 * @Author QJ
 * @date 2020--12 16:29
 * @desc spark-md5-worker.js
 */
this.importScripts('./spark-md5.min.js');

this.onmessage = function (e) {
  console.log('this', this);
  const {chunks} = e.data;
  const spark = new this.SparkMD5.ArrayBuffer();
  let counter = 0;
  const len = chunks.length;


  const load = (index) => {
    const fileReader = new FileReader();

    fileReader.onload = (e) => {
      counter ++;
      spark.append(e.target['result']);
      if(counter === len) {
        // 运算完毕
        this.postMessage({
          hash: spark.end(),
          progress: 1
        })
      }else{
        this.postMessage({progress: Number((counter / len).toFixed(2))});
        load(counter);
      }
    };

    fileReader.readAsArrayBuffer(chunks[index].chunk);
  };

  load(0);
  console.log(chunks);

}



