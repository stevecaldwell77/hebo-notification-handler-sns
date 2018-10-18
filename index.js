const assert = require('assert');
const isFunction = require('lodash/isFunction');
const isPlainObject = require('lodash/isPlainObject');
const autoBind = require('auto-bind');

class NotificationHandlerSns {
    constructor({ snsClient, topicArns } = {}) {
        assert(snsClient, 'NotificationHandlerSns: snsClient required');
        assert(
            isFunction(snsClient.publish),
            'NotificationHandlerSns: snsClient must provide publish()',
        );

        assert(topicArns, 'NotificationHandlerSns: topicArns required');
        assert(
            isPlainObject(topicArns),
            'NotificationHandlerSns: topicArns must be a plain object',
        );
        assert(
            topicArns.invalidEventsFound,
            'NotificationHandlerSns: no invalidEventsFound topicArn',
        );
        assert(
            topicArns.eventWritten,
            'NotificationHandlerSns: no eventWritten topicArn',
        );

        this.snsClient = snsClient;
        this.topicArns = topicArns;
        autoBind(this);
    }

    publish(notificationType, notification) {
        const topicArn = this.topicArns[notificationType];
        assert(topicArn, `no topicArn for ${notificationType}`);
        return this.snsClient
            .publish({
                TopicArn: topicArn,
                Message: JSON.stringify({
                    notificationType,
                    notification,
                }),
            })
            .promise();
    }

    invalidEventsFound(notification) {
        return this.publish('invalidEventsFound', notification);
    }

    eventWritten(notification) {
        return this.publish('eventWritten', notification);
    }
}

module.exports = NotificationHandlerSns;
