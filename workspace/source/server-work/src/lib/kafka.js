/* istanbul ignore file */
const debug = require('debug')('ttc:kafka');
const config = require('config');
const { v4: uuid } = require('uuid');
const { Kafka, CompressionTypes, logLevel: kafkaLogLevel } = require('kafkajs');

const { KafkaLogCreator } = require('./error');

const { brokers, topic, clientId } = config.get('kafka');
const groupId = `${clientId}-${uuid()}`;

const kafka = new Kafka({
    clientId,
    brokers,
    logLevel: kafkaLogLevel.ERROR,
    logCreator: KafkaLogCreator
});

const consumer = kafka.consumer({ groupId });
const producer = kafka.producer();

const produce = async (payload) => {
    let value;
    try {
        value = JSON.stringify(payload);
    } catch (err) {
        value = payload;
    }
    const key =
        (payload.data && payload.data.src && payload.data.src.toString()) ||
        null;
    await producer.send({
        topic,
        compression: CompressionTypes.GZIP,
        messages: [
            {
                key: null,
                value,
                partition: null //key ? 0 : null
            }
        ]
    });
};

const connect = async () => {
    await consumer.connect();
    await consumer.subscribe({ topic });

    await producer.connect();
    debug('Connect to Kafka');
};

const SIGNALS = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
for (let type of SIGNALS) {
    process.once(type, async () => {
        try {
            consumer.disconnect();
            producer.disconnect();
        } finally {
            process.kill(process.pid, type);
        }
    });
}

module.exports = {
    connect,
    consumer,
    kafka,
    produce
};
