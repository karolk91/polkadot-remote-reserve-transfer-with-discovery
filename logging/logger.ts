import pino from 'pino'

export const logger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      destination: 1,
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss.l',
      ignore: 'pid,hostname',
      singleLine: false,
      sync: true,
    },
  },
})
