const assert = require('assert');
const uuid = require('uuid/v4');
const autoBind = require('auto-bind');
const { isString } = require('lodash');

class MockSns {
    constructor({ sqsClient } = {}) {
        this.topics = {};
        this.sqsClient = sqsClient;
        autoBind(this);
    }

    createTopic({ Name: name }) {
        const arn = `arn:aws:sns:mocklocal:123456789012:${name}`;
        this.topics[arn] = this.topics[arn] || {
            subscribers: {},
        };
        return {
            promise: () =>
                Promise.resolve({
                    TopicArn: arn,
                }),
        };
    }

    deleteTopic({ TopicArn: topicArn }) {
        delete this.topics[topicArn];
        return { promise: () => Promise.resolve({}) };
    }

    subscribe({ Protocol: protocol, TopicArn: topicArn, Endpoint: sqsArn }) {
        assert(sqsArn, 'MockSns: missing Endpoint');
        assert(protocol === 'sqs', 'MockSns: only supports sqs subscriptions');
        assert(this.topics[topicArn], `MockSns: unknown TopicArn ${topicArn}`);
        const subscriptionArn = `${topicArn}:${uuid()}`;
        this.topics[topicArn].subscribers[subscriptionArn] = sqsArn;
        return {
            promise: () =>
                Promise.resolve({
                    SubscriptionArn: subscriptionArn,
                }),
        };
    }

    publish({ TopicArn: topicArn, Message: message }) {
        assert(
            this.topics[topicArn],
            `publish(): unknown TopicArn ${topicArn}`,
        );
        assert(message, `publish(): no Message`);
        assert(isString(message), `publish(): Message must be a string`);

        const { sqsClient } = this;
        const { subscribers } = this.topics[topicArn];
        const sqsArns = Object.values(subscribers);
        const sqsMessage = {
            Type: 'Notification',
            MessageId: uuid(),
            TopicArn: topicArn,
            Message: message,
        };
        const sqsUrls = sqsArns.map(sqsClient.arnToUrl);
        const sendMessage = url =>
            sqsClient.sendMessage({
                MessageBody: JSON.stringify(sqsMessage),
                QueueUrl: url,
            });
        return {
            promise: async () => {
                await Promise.all(sqsUrls.map(sendMessage));
                return { MessageId: uuid() };
            },
        };
    }
}

module.exports = MockSns;
