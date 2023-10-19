import { io } from "socket.io-client";

const URL =
  process.env.NODE_ENV === "production" ? undefined : "http://localhost:3010";

export const socket = io(URL, {
  autoConnect: false,
});
