/**
 * @Author QJ
 * @date 2020--11 11:24
 * @desc upload.js
 */
const express = require('express');
const path = require('path');
const fse = require('fs-extra');
const fs = require('fs');
const multiparty = require('multiparty');
const router = express.Router();

const TEMP_PATH = path.resolve(__dirname, '../temp');
const UPLOAD_PATH = path.resolve(__dirname, '../upload');

router.post('/chunk', (req, res) => {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if(err) return console.log('图片上传pase失败', err);

    const [chunkname] = fields.chunkname;
    const [hash] = fields.hash;
    const [ext] = fields.ext;
    const [chunk] = files.chunk;

    // 检查文件目录是否存在
    const isExistDir = await fse.pathExists(path.resolve(TEMP_PATH, hash));
    if(!isExistDir) {
      // 创建目录
      await fse.ensureDir(path.resolve(TEMP_PATH, hash));

    }
    console.log(chunkname + ext);
    // 移动文件
    await fse.move(chunk.path, path.resolve(TEMP_PATH, hash, chunkname + ext));

    res.json({
      error_code: 0,
      message: `${chunkname}上传成功`
    })


  });


});

router.post('/sample', (req, res) => {
  const form = new multiparty.Form();
  form.parse(req, async (err, fields, files) => {
    console.log(fields);
    console.log(files);
    const [hash] = fields.hash;
    const [file] = files.file;
    const ext = path.extname(file.path);
    const destination = `${UPLOAD_PATH}/${hash + ext}`;

    try {
      await fse.move(file.path, destination);
    }catch (err) {
        console.log('移动文件出错', err);
    }
    res.end('success');

  });


});

router.post('/check', async (req, res) => {
  const {ext, hash} = req.body;
  const filePath = path.resolve(UPLOAD_PATH, hash + ext);
  const isExist = await fse.pathExists(filePath);

  let returnData = {};

  if(isExist) {
    returnData = {
      uploaded: true,
      uploadedList: []
    }
  }else {
    returnData = {
      uploaded: false,
      uploadedList: await getUploadedList(path.resolve(TEMP_PATH, hash))
    }
  }

  console.log(returnData);

  res.json({
    error_code: 0,
    data: returnData
  });
});

router.post('/merge', async (req, res) => {
  const {hash, ext, size} = req.body;
  const writeFilePath = path.resolve(UPLOAD_PATH, hash + ext);
  const readFileDir = path.resolve(TEMP_PATH, hash);
  // console.log('hash', hash);
  // console.log('ext', ext);
  // console.log('size', size);

  // 读取目录
  const filePaths = (await fse.readdir(path.resolve(TEMP_PATH, hash))).sort((a, b) => {
    let numA = parseInt(a.split('-')[1]);
    let numB = parseInt(b.split('-')[1]);
    return numA - numB;
  }).map(item => path.resolve(TEMP_PATH, hash, item));

  // console.log(filePaths);

  await fse.writeFile(writeFilePath, '');
  filePaths.forEach(filePath => {
    let data = fse.readFileSync(filePath);
    fse.appendFileSync(writeFilePath, data);
    fse.removeSync(filePath);
  });
  fse.removeSync(readFileDir);



  /*await Promise.all(filePaths.map((filePath, index) => (
    piperWriteFile(filePath, fs.createWriteStream(path.resolve(UPLOAD_PATH, hash + ext), {
      start: index * size,
      end: (index + 1) * size
    }))
  )));*/

  // 删除文件夹
  fse.removeSync(path.resolve(TEMP_PATH, hash));

  res.json({
    error_code: 0,
    message: 'success'
  })

});

/**
 * 管道写入文件
 * @param readFilePath
 * @param writeStream
 * @returns {Promise<*>}
 */
async function piperWriteFile(readFilePath, writeStream) {
  return new Promise((resolve, reject) => {
    let readStream = fs.createReadStream(readFilePath);
    readStream.on('end', () => {
      fse.removeSync(readFilePath);
      resolve();
    });
    readStream.on('error', (e) => {
      console.log('出错', e);
      reject();
    });
    readStream.pipe(writeStream);
  })
}





async function getUploadedList(dirPath) {
  return await fse.pathExists(dirPath) ? fse.readdirSync(dirPath).filter(item => item.indexOf('.') > 0) : []
}

module.exports = router;
