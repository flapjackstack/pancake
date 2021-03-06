import io from "socket.io-client";
import { debounce } from "lodash";
import { default as store, designerOperations } from "./store";

const mockupSocket = io(`${window.location.origin}/mockups`, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 3
});

// Actions
export const connectToSession = mockupId => {
  if (!mockupSocket.connected) mockupSocket.connect();
  console.log("Joining mockup session", mockupId);
  mockupSocket.emit("join-session", { mockupId });
  store.dispatch(designerOperations.setConnecting());
};

export const disconnectFromSession = mockupId => {
  if (mockupSocket.connected) {
    mockupSocket.emit("leave-session", { mockupId });
  }
  console.log("Leaving mockup session", mockupId);
  store.dispatch(designerOperations.setError(""));
};

export const dispatchNetworkAction = action => {
  console.log("Sending action to server", action);
  if (store.getState().designer.networkStatus.connected) mockupSocket.emit("dispatch-action", action);
  else console.log("Cannot dispatch action because we are not connected to a session.", action);
};

// Application Events
mockupSocket.on("load-initial-state", state => {
  console.log("Joined session.");
  store.dispatch(designerOperations.setConnected());
  store.dispatch(designerOperations.loadElements(state));
});

// Combines multiple UPDATE_ELEMENT actions that arrive all at once into a single bulk update.
// This avoids render thrashing when dispatching many separate UPDATE actions (each of which causes)
// a render.
let actionQueue = [];
const dispatchUpdate = debounce((store, action) => {
  console.log(`Dispatching ${actionQueue.length} update actions.`);
  if (actionQueue.length === 1) {
    store.dispatch(action);
  } else {
    const updateArray = actionQueue.map(action => action.payload);
    store.dispatch(designerOperations.bulkUpdateElements(updateArray));
  }
  actionQueue = [];
}, 100);

mockupSocket.on("update-mockup-state", action => {
  if (action.type === "designer/UPDATE_ELEMENT") {
    actionQueue.push(action);
    dispatchUpdate(store, action);
  } else {
    store.dispatch(action);
  }
});

mockupSocket.on("exception", error => {
  console.error("Forcibly disconnected from server.", error);
  store.dispatch(designerOperations.setError(`Server closed the socket connection. (${error})`));
});

// Socket.IO Events
mockupSocket.on("connect", () => {
  console.log("Connected to mockup socket.");
});

mockupSocket.on("connect_error", error => {
  console.log("connect_error", error);
});

mockupSocket.on("connect_timeout", error => {
  console.log("connect_timeout", error);
});

mockupSocket.on("reconnect", attempt => {
  console.log("reconnect", attempt);
  store.dispatch(designerOperations.loadMockup());
});

mockupSocket.on("reconnecting", attempt => {
  console.log("reconnecting", attempt);
  store.dispatch(designerOperations.setReconnecting());
});

mockupSocket.on("reconnect_error", () => {
  console.log("reconnect_error");
});

mockupSocket.on("reconnect_failed", () => {
  console.log("reconnect_failed");
  store.dispatch(designerOperations.setError("There was a problem establishing a connection to the server."));
});

mockupSocket.on("error", error => {
  console.log("Socket Error", error);
  store.dispatch(designerOperations.setError(error));
});

mockupSocket.on("disconnect", () => {
  console.log("Disconnected from mockup socket.");
});

export default mockupSocket;
