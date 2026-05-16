import { Test, TestingModule } from '@nestjs/testing';
import { RedactSensitiveInterceptor } from './redact-sensitive.interceptor';
import { ConfigService } from '@nestjs/config';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';

const mockConfigService = {
  get: jest.fn().mockReturnValue('my-super-secret'),
};

describe('RedactSensitiveInterceptor (P8, P9)', () => {
  let interceptor: RedactSensitiveInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedactSensitiveInterceptor,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    interceptor = module.get<RedactSensitiveInterceptor>(RedactSensitiveInterceptor);
  });

  function createContext(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('should pass through data without sensitive fields (P8)', async () => {
    const ctx = createContext();
    const handler: CallHandler = { handle: () => of({ id: 1, name: 'project' }) };

    const result$ = interceptor.intercept(ctx, handler);
    const result = await lastValueFrom(result$);
    expect(result).toEqual({ id: 1, name: 'project' });
  });

  it('should redact api_key in config_json (P9: API key masking)', async () => {
    const ctx = createContext();
    const handler: CallHandler = {
      handle: () => of({
        id: 1,
        config_json: { api_key: 'sk-very-secret-key', base_url: 'https://api.openai.com' },
      }),
    };

    const result$ = interceptor.intercept(ctx, handler);
    const result = await lastValueFrom(result$) as any;
    expect(result.config_json.api_key).not.toBe('sk-very-secret-key');
    // Last 4 chars of 'sk-very-secret-key' is '-key'
    expect(result.config_json.api_key).toContain('-key');
  });

  it('should redact ssh_key_path (P8)', async () => {
    const ctx = createContext();
    const handler: CallHandler = {
      handle: () => of({ id: 1, ssh_key_path: '/home/user/.ssh/id_rsa' }),
    };

    const result$ = interceptor.intercept(ctx, handler);
    const result = await lastValueFrom(result$) as any;
    expect(result.ssh_key_path).toBe('[REDACTED]');
  });
});
