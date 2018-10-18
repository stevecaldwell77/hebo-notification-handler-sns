const test = require('ava');
const { noop } = require('lodash');
const NotificationHandlerSns = require('..');

test('constructor - no params', t => {
    t.throws(
        () => new NotificationHandlerSns(),
        Error,
        'no params throws error',
    );

    t.throws(
        () => new NotificationHandlerSns({}),
        Error,
        'empty params throws error',
    );
});

test('constructor - snsClient', t => {
    const topicArns = {
        invalidEventsFound: 'arn:aws:sns:testing:123456789012:topic1',
        eventWritten: 'arn:aws:sns:testing:123456789012:topic2',
    };

    t.throws(
        () => new NotificationHandlerSns({ topicArns }),
        /snsClient required/,
        'snsClient required',
    );

    t.throws(
        () => new NotificationHandlerSns({ topicArns, snsClient: {} }),
        /snsClient must provide publish()/,
        'publish required',
    );

    t.notThrows(
        () =>
            new NotificationHandlerSns({
                topicArns,
                snsClient: { publish: noop },
            }),
        'valid params lives',
    );
});

test('constructor - topicArns', t => {
    const snsClient = { publish: noop };
    const arn1 = 'arn:aws:sns:testing:123456789012:topic1';
    const arn2 = 'arn:aws:sns:testing:123456789012:topic2';

    t.throws(
        () => new NotificationHandlerSns({ snsClient }),
        /topicArns required/,
        'topicArns required',
    );

    t.throws(
        () => new NotificationHandlerSns({ snsClient, topicArns: [] }),
        /topicArns must be a plain object/,
        'topicArns type',
    );

    t.throws(
        () =>
            new NotificationHandlerSns({
                snsClient,
                topicArns: { eventWritten: arn2 },
            }),
        /no invalidEventsFound topicArn/,
        'eventWritten arn required',
    );

    t.throws(
        () =>
            new NotificationHandlerSns({
                snsClient,
                topicArns: { invalidEventsFound: arn1 },
            }),
        /no eventWritten topicArn/,
        'eventWritten arn required',
    );

    t.notThrows(
        () =>
            new NotificationHandlerSns({
                snsClient,
                topicArns: { invalidEventsFound: arn1, eventWritten: arn2 },
            }),
        'valid params lives',
    );
});
