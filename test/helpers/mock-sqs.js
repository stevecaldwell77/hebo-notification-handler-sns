const assert = require('assert');
const uuid = require('uuid/v4');
const { sampleSize } = require('lodash');
const autoBind = require('auto-bind');

class MockSqsClient {
    constructor() {
        this.queues = {};
        autoBind(this);
    }

    createQueue({ QueueName: name }) {
        const queueUrl = `https://mock.amazonaws.com/123456789012/${name}`;
        const arn = `arn:aws:sns:mocklocal:123456789012:${name}`;
        this.queues[queueUrl] = this.queues[queueUrl] || {
            messageIds: [],
            messageBodies: {},
            receiptHandles: {},
            arn,
        };
        return {
            promise: () => Promise.resolve({ QueueUrl: queueUrl }),
        };
    }

    arnToUrl(arn) {
        const urls = Object.keys(this.queues);
        const matchesArn = url => this.queues[url].arn === arn;
        const matches = urls.filter(matchesArn);
        return matches.length > 0 ? matches[0] : undefined;
    }

    deleteQueue({ QueueUrl: queueUrl }) {
        delete this.queues[queueUrl];
        return { promise: () => Promise.resolve({}) };
    }

    sendMessage({ MessageBody: msg, QueueUrl: url }) {
        assert(msg, `sendMessage: missing MessageBody`);
        assert(url, `sendMessage: missing QueueUrl`);
        assert(this.queues[url], `sendMessage: unknown queue ${url}`);
        const queue = this.queues[url];
        const messageId = uuid();
        queue.messageIds.push(messageId);
        queue.messageBodies[messageId] = msg;
        return {
            promise: () => Promise.resolve({}),
        };
    }

    receiveMessage({ QueueUrl: url }) {
        assert(url, `receiveMessage: missing QueueUrl`);
        assert(this.queues[url], `receiveMessage: unknown queue ${url}`);
        const queue = this.queues[url];
        const messageIds = sampleSize(queue.messageIds, 1);
        const messages = messageIds.map(id => ({
            MessageId: id,
            ReceiptHandle: uuid(),
            Body: queue.messageBodies[id],
        }));
        const newReceiptHandles = messages.reduce(
            (accum, cur) => ({
                ...accum,
                [cur.ReceiptHandle]: cur.MessageId,
            }),
            {},
        );
        queue.receiptHandles = {
            ...queue.receiptHandles,
            ...newReceiptHandles,
        };
        return {
            promise: () => Promise.resolve({ Messages: messages }),
        };
    }

    deleteMessage({ QueueUrl: url, ReceiptHandle: handle }) {
        assert(url, `deleteMessage: missing QueueUrl`);
        assert(this.queues[url], `deleteMessage: unknown queue ${url}`);
        const queue = this.queues[url];
        const messageId = queue.receiptHandles[handle];
        assert(messageId, `deleteMessage: unknown ReceiptHandle ${handle}`);
        queue.messageIds = queue.messageIds.filter(v => v !== messageId);
        delete queue.messageBodies[messageId];
        delete queue.receiptHandles[handle];
        return { promise: () => Promise.resolve({}) };
    }

    setQueueAttributes() {
        return { promise: () => Promise.resolve({}) };
    }

    getQueueAttributes({ QueueUrl: url, AttributeNames: attrNames }) {
        assert(url, `getQueueAttributes: missing QueueUrl`);
        assert(attrNames, `getQueueAttributes: missing AttributeNames`);
        assert(this.queues[url], `getQueueAttributes: unknown queue ${url}`);
        assert.deepStrictEqual(
            attrNames,
            ['All'],
            `getQueueAttributes: we only support AttributeNames of ['All']`,
        );
        const queueArn = this.queues[url].arn;
        const result = { Attributes: { QueueArn: queueArn } };
        return { promise: () => Promise.resolve(result) };
    }
}

module.exports = MockSqsClient;
