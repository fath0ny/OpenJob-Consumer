import 'dotenv/config';
import amqp from 'amqplib';
import ApplicationService from './ApplicationService.js';
import MailSender from './MailSender.js';
import Listener from './listener.js';

const QUEUE_NAME = 'applications:new';

const getAmqpUrl = () => {
  if (process.env.AMQP_URL) return process.env.AMQP_URL;

  const host = process.env.RABBITMQ_HOST;
  const port = process.env.RABBITMQ_PORT || 5672;
  const user = process.env.RABBITMQ_USER;
  const password = process.env.RABBITMQ_PASSWORD;

  if (user && password) {
    return `amqp://${user}:${password}@${host}:${port}`;
  }

  return `amqp://${host}:${port}`;
};

const init = async () => {
  const applicationService = new ApplicationService();
  const mailSender = new MailSender();
  const listener = new Listener(applicationService, mailSender);

  const connection = await amqp.connect(getAmqpUrl());

  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, {
    durable: true,
  });

  channel.consume(QUEUE_NAME, listener.listen, { noAck: true });
};

init();