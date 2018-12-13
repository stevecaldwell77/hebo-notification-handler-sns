/*

To run this test against a live database, do the following:

    HEBO_LIVE_SNS_TEST=1 npx ava test/spec.js

*/
const test = require('ava');
const AWS = require('aws-sdk');
const shortid = require('shortid');
const delay = require('delay');
const { sortBy } = require('lodash');
const { validateNotificationHandler } = require('hebo-validation');
const NotificationHandlerSns = require('..');
const MockSqsClient = require('./helpers/mock-sqs');
const MockSnsClient = require('./helpers/mock-sns');

const isLive = Boolean(process.env.HEBO_LIVE_SNS_TEST);

const getLiveClients = () => ({
    sqsClient: new AWS.SQS(),
    snsClient: new AWS.SNS(),
});

const getMockClients = () => {
    const sqsClient = new MockSqsClient();
    const snsClient = new MockSnsClient({ sqsClient });
    return { sqsClient, snsClient };
};

const getClients = () => (isLive ? getLiveClients() : getMockClients());

const setupSns = async ({ snsClient }) => {
    const generateName = () => `hebotest-${shortid.generate()}`;
    const createTopic = () =>
        snsClient.createTopic({ Name: generateName() }).promise();
    const responses = await Promise.all([createTopic(), createTopic()]);
    const getArn = response => response.TopicArn;
    const [invalidEventsFoundArn, eventWrittenArn] = responses.map(getArn);
    return { invalidEventsFoundArn, eventWrittenArn };
};

const setupSqs = async ({ sqsClient, snsClient, snsTopicArns }) => {
    const { QueueUrl: queueUrl } = await sqsClient
        .createQueue({
            QueueName: `hebotest-${shortid.generate()}`,
        })
        .promise();
    const { Attributes: queueAttributes } = await sqsClient
        .getQueueAttributes({
            QueueUrl: queueUrl,
            AttributeNames: ['All'],
        })
        .promise();
    const queueArn = queueAttributes.QueueArn;
    const iamStatement = snsTopicArn => ({
        Effect: 'Allow',
        Principal: '*',
        Action: 'sqs:SendMessage',
        Resource: queueArn,
        Condition: { ArnEquals: { 'aws:SourceArn': snsTopicArn } },
    });
    const queuePolicy = {
        Version: '2012-10-17',
        Statement: snsTopicArns.map(iamStatement),
    };
    await sqsClient
        .setQueueAttributes({
            QueueUrl: queueUrl,
            Attributes: {
                Policy: JSON.stringify(queuePolicy),
            },
        })
        .promise();
    const subscribeQueue = snsTopicArn =>
        snsClient
            .subscribe({
                Protocol: 'sqs',
                TopicArn: snsTopicArn,
                Endpoint: queueArn,
            })
            .promise();
    await Promise.all(snsTopicArns.map(subscribeQueue));
    return { queueUrl };
};

test.before(async t => {
    const { snsClient, sqsClient } = getClients();
    const { invalidEventsFoundArn, eventWrittenArn } = await setupSns({
        snsClient,
    });
    const { queueUrl } = await setupSqs({
        sqsClient,
        snsClient,
        snsTopicArns: [invalidEventsFoundArn, eventWrittenArn],
    });
    const notificationHandler = new NotificationHandlerSns({
        snsClient,
        topicArns: {
            invalidEventsFound: invalidEventsFoundArn,
            eventWritten: eventWrittenArn,
        },
    });
    t.context.notificationHandler = notificationHandler;
    t.context.snsClient = snsClient;
    t.context.sqsClient = sqsClient;
    t.context.sqsQueueUrl = queueUrl;
    t.context.snsTopicArns = [invalidEventsFoundArn, eventWrittenArn];
});

test.after.always('guaranteed cleanup', async t => {
    const { sqsClient, snsClient, sqsQueueUrl, snsTopicArns } = t.context;
    const deleteTopic = arn =>
        snsClient.deleteTopic({ TopicArn: arn }).promise();
    await Promise.all([
        ...snsTopicArns.map(deleteTopic),
        sqsClient.deleteQueue({ QueueUrl: sqsQueueUrl }).promise(),
    ]);
});

const getMessages = async ({
    sqsClient,
    sqsQueueUrl,
    numMessages,
    foundSoFar = [],
    attempts = 0,
}) => {
    // End when we've retrieved the expected number of messages, or we've tried
    // 10 times.
    if (foundSoFar.length === numMessages || attempts >= 10) {
        return foundSoFar;
    }

    // If we're live, wait a little before proceeding.
    if (isLive) {
        await delay(2000);
    }

    // Pull what messages we can
    const response = await sqsClient
        .receiveMessage({ QueueUrl: sqsQueueUrl })
        .promise();
    const messages = response.Messages;

    // Delete the pulled messages from the queue
    const deleteMessage = msg =>
        sqsClient
            .deleteMessage({
                QueueUrl: sqsQueueUrl,
                ReceiptHandle: msg.ReceiptHandle,
            })
            .promise();
    await Promise.all(messages.map(deleteMessage));

    // Store the extracted message
    const getBody = msg => JSON.parse(msg.Body);
    const getBodyMessage = msg => JSON.parse(getBody(msg).Message);
    foundSoFar.push(...messages.map(getBodyMessage));

    // Call again
    return getMessages({
        sqsClient,
        sqsQueueUrl,
        numMessages,
        foundSoFar,
        attempts: attempts + 1,
    });
};

const sortMessages = messages => sortBy(messages, 'notification.aggregateId');

test('passes validator', t => {
    const { notificationHandler } = t.context;
    const { error } = validateNotificationHandler(notificationHandler);
    t.is(error, null, 'no error generated by validation');
});

test.serial('invalidEventsFound()', async t => {
    const { notificationHandler, sqsClient, sqsQueueUrl } = t.context;

    const notification1 = {
        aggregateName: 'library',
        aggregateId: shortid.generate(),
        eventIds: [shortid.generate()],
    };

    const notification2 = {
        aggregateName: 'author',
        aggregateId: shortid.generate(),
        eventIds: [shortid.generate(), shortid.generate()],
    };

    await notificationHandler.invalidEventsFound(notification1);
    await notificationHandler.invalidEventsFound(notification2);

    const messages = await getMessages({
        sqsClient,
        sqsQueueUrl,
        numMessages: 2,
    });

    const expectedMessages = [
        { notificationType: 'invalidEventsFound', notification: notification1 },
        { notificationType: 'invalidEventsFound', notification: notification2 },
    ];

    t.deepEqual(
        sortMessages(messages),
        sortMessages(expectedMessages),
        'expectedMessages published',
    );
});

test.serial('eventWritten()', async t => {
    const { notificationHandler, sqsClient, sqsQueueUrl } = t.context;

    const notification1 = {
        aggregateName: 'library',
        aggregateId: shortid.generate(),
        eventType: 'CREATED',
    };

    const notification2 = {
        aggregateName: 'author',
        aggregateId: shortid.generate(),
        eventType: 'NAME_SET',
    };

    await notificationHandler.eventWritten(notification1);
    await notificationHandler.eventWritten(notification2);

    const messages = await getMessages({
        sqsClient,
        sqsQueueUrl,
        numMessages: 2,
    });

    const expectedMessages = [
        { notificationType: 'eventWritten', notification: notification1 },
        { notificationType: 'eventWritten', notification: notification2 },
    ];

    t.deepEqual(
        sortMessages(messages),
        sortMessages(expectedMessages),
        'expectedMessages published',
    );
});
