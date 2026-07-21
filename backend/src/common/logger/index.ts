import {
  createLogger,
  format,
  Logger as WinstonLogger,
  transports,
} from 'winston';

const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, timestamp, label }) => {
  return `${String(timestamp)} ${String(label)} ${level} ${String(message)}`;
});

const Logger = (context: string): WinstonLogger => {
  return createLogger({
    level: 'debug',
    format: combine(
      format.colorize(),
      label({ label: context }),
      timestamp(),
      myFormat,
    ),
    transports: [
      new transports.File({
        filename: 'error.log',
        level: 'error',
        dirname: './logs',
      }),
      new transports.File({ filename: 'combined.log', dirname: './logs' }),
      new transports.Console(),
    ],
  });
};

export default Logger;
