import { createServer } from "node:http";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectMongo } from "./db/mongoose.js";
import { attachCollaborationSocket } from "./sockets/collab.js";

async function bootstrap() {
  await connectMongo(env.mongoUri);

  const app = createApp();
  const httpServer = createServer(app);

  attachCollaborationSocket(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`backend listening on :${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
