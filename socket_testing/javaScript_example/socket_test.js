const { io } = require('socket.io-client');
const path = require('path');
const fs = require('fs');

const getUpdateData = (filepath) => {
  let data = fs.readFileSync(path.join(__dirname, filepath), { encoding: 'utf-8' });
  data = JSON.parse(data);

  return data.updateData; // array of update objects
};

/**
 *
 * @param {number} ms time in milliseconds
 * @returns
 */
const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('');
    }, ms);
  });
};

const socket = io('http://127.0.0.1:5051');

socket.on('connect', async () => {
  console.log(socket.connected);

  const updateData = getUpdateData(path.join(__dirname, '..', 'data', 'test_update_dataV2.json'));

  for (const updateObj of updateData) {
    socket.emit('glimpse', updateObj);

    // create some delay
    await sleep(750);
  }

  socket.disconnect();
});
