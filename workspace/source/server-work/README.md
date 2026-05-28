# Touch To CONNECT Server

Node.js server for Touch To CONNECT

You only need to run this if you are making changes to the server. For CONNECT desktop/UI development, you can connect to stage.

### Prequesites

You must have `Node.js`, `npm`, `docker`, and `docker-compose` installed on your machine.

### Install

Clone this repo and run `npm install`

### Running for local development

Run `npm start`. This will start up Docker containers for MongoDB, Kafka, and Zookeeper, as well as the server. This command will put you in the `app-server` container with the server running. You may see a few Kafka connection errors at first. If you see the following, your server is ready to go:

```
  ttc:database Connected to mongodb +0ms
  ttc:kafka Connect to Kafka +127ms
  ttc:main Listening on 7000 +21ms
```

To restart the server, simply type `rs` to send a restart to nodemon.

If you are working on CONNECT, you will need to change `apiBaseURL` in `main/config` and any instances of the stage URL to `http://localhost:7000`.

### Stopping the app and cleaning up

When you are done working with the server, run `npm run down` to stop all running containers.

npm run compose -- exec ksqldb ksql http://localhost:8088
