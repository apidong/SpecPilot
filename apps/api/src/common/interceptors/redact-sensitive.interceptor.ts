import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class RedactSensitiveInterceptor implements NestInterceptor {
  private readonly workerSecret: string;
  private readonly workerSecretRegex: RegExp | null;

  constructor(private readonly config: ConfigService) {
    this.workerSecret = config.get<string>('WORKER_SECRET', '');
    this.workerSecretRegex = this.workerSecret
      ? new RegExp(this.escapeRegex(this.workerSecret), 'g')
      : null;
  }

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => this.workerSecretRegex ? this.redact(data) : data),
    );
  }

  private redact(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') return this.redactString(data);
    if (Array.isArray(data)) return data.map((item) => this.redact(item));
    if (typeof data === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (key === 'config_json' && typeof value === 'object' && value !== null) {
          // Mask API key in agent config_json
          const configJson = { ...(value as Record<string, unknown>) };
          if (typeof configJson['api_key'] === 'string') {
            configJson['api_key'] = this.maskApiKey(configJson['api_key'] as string);
          }
          result[key] = configJson;
        } else if (key === 'ssh_key_path') {
          // Never expose SSH key path
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.redact(value);
        }
      }
      return result;
    }
    return data;
  }

  private redactString(str: string): string {
    if (this.workerSecretRegex && str.includes(this.workerSecret)) {
      return str.replace(this.workerSecretRegex, '[REDACTED]');
    }
    return str;
  }

  private maskApiKey(key: string): string {
    if (key.length >= 4) {
      return '•'.repeat(key.length - 4) + key.slice(-4);
    }
    return '•'.repeat(key.length);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
