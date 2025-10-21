**Created:**

```
backend/src/
├── sockets/
│   ├── index.js                      (Socket.IO setup, handler registration)
│   ├── middlewares/
│   │   └── auth.middleware.js        (JWT handshake authentication)
│   └── handlers/
│       ├── chat.handler.js           (sendMessage, typing events)
│       └── status.handler.js         (connection, disconnect, online status)
├── api/
│   ├── routes/
│   │   ├── conversation.routes.js    (Conversation endpoints)
│   │   └── message.routes.js         (Message history endpoint)
│   ├── controllers/
│   │   ├── conversation.controller.js
│   │   └── message.controller.js
│   └── services/
│       ├── conversation.service.js   (Business logic for conversations)
│       └── message.service.js        (Business logic for messages)
```
