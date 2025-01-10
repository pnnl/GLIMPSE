import { io } from "socket.io-client";

const socket = io("http://127.0.0.1:5051");

socket.on("connect", () => {
   console.log("connected to glimpse local websocket server");
});

export const sendNatigConfig = (configurationObj) => {
   if (socket.connected) {
      socket.emit("natig-config", configurationObj, (ack) => console.log(ack));
   }
};
