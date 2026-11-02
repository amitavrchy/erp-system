import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch()
export class ApiFilter implements ExceptionFilter {
  private logger = new Logger('API');
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      res.status(error.getStatus()).json(error.getResponse());
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const messages: Record<string, [number, string]> = {
        P2002: [409, 'A record with this identifier already exists'],
        P2003: [
          409,
          'This record is linked to other records and cannot be removed',
        ],
        P2025: [404, 'Record not found'],
        P2034: [409, 'Another update occurred. Please retry.'],
      };
      const match = messages[error.code];
      if (match) {
        res.status(match[0]).json({ message: match[1] });
        return;
      }
    }
    this.logger.error(error);
    res
      .status(500)
      .json({ message: 'An unexpected error occurred. Please retry.' });
  }
}
