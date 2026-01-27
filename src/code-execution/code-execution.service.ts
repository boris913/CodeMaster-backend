// src/code-execution/code-execution.service.ts
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Language } from '@prisma/client';
import Docker from 'dockerode';
import type { ContainerCreateOptions } from 'dockerode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';

interface ExecutionResult {
  output: string;
  error: string;
  executionTime: number;
  memoryUsed: number;
  passed: boolean;
  testResults?: Array<{ name?: string; passed?: boolean; error?: string }>;
}

interface ContainerStatsData {
  cpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
  };
  precpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
  };
  memory_stats?: { usage?: number };
}

@Injectable()
export class CodeExecutionService {
  private readonly logger = new Logger(CodeExecutionService.name);
  private docker: Docker;
  private readonly tempDir: string;

  constructor(private configService: ConfigService) {
    this.docker = new Docker();
    this.tempDir = path.join(os.tmpdir(), 'codemaster-executions');
    void this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create temp directory: ${errorMessage}`);
    }
  }

  async executeCode(
    code: string,
    language: Language,
    testSuite: string,
    timeLimit = 30,
    memoryLimit = 128,
  ): Promise<ExecutionResult> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const containerId = uuidv4();
    const containerConfig = this.getContainerConfig(
      language,
      code,
      testSuite,
      timeLimit,
      memoryLimit,
    );

    let container: any = null;

    try {
      // Créer le conteneur
      container = await this.docker.createContainer({
        ...containerConfig,
        name: `exec-${containerId}`,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await container.start();

      // Attendre la fin de l'exécution avec timeout
      const timeout = (timeLimit + 5) * 1000; // +5 seconds buffer
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const waitPromise = container.wait();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), timeout);
      });

      await Promise.race([waitPromise, timeoutPromise]);

      // Récupérer les logs
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        follow: false,
      });

      // Convertir les logs en string
      const logsOutput = Buffer.isBuffer(logs)
        ? logs.toString('utf8')
        : String(logs);

      // Récupérer les stats
      const statsData = await this.getContainerStats(container);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await container.remove({ force: true });

      const outputTrimmed = logsOutput.trim();

      // Analyser la sortie pour déterminer si les tests ont réussi
      const passed = this.evaluateTestOutput(outputTrimmed);
      const testResults = this.parseTestResults(outputTrimmed);

      return {
        output: outputTrimmed,
        error: '',
        executionTime: this.calculateExecutionTime(statsData),
        memoryUsed: this.calculateMemoryUsage(statsData),
        passed,
        testResults,
      };
    } catch (error: unknown) {
      // Nettoyer le conteneur en cas d'erreur
      if (container) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          await container.remove({ force: true });
        } catch (removeError: unknown) {
          const removeErrorMessage =
            removeError instanceof Error
              ? removeError.message
              : 'Unknown error during container removal';
          this.logger.warn(
            `Failed to remove container after error: ${removeErrorMessage}`,
          );
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown execution error';
      this.logger.error(`Code execution failed: ${errorMessage}`);
      throw new ServiceUnavailableException(
        `Code execution failed: ${errorMessage}`,
      );
    }
  }

  private async getContainerStats(container: any): Promise<ContainerStatsData> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const stats = await container.stats({ stream: false });
      return stats as unknown as ContainerStatsData;
    } catch {
      return {};
    }
  }

  private getContainerConfig(
    language: Language,
    code: string,
    testSuite: string,
    timeLimit: number,
    memoryLimit: number,
  ): ContainerCreateOptions {
    const configs: Record<Language, { image: string; cmd: string[] }> = {
      [Language.JAVASCRIPT]: {
        image: 'node:18-alpine',
        cmd: ['node', '-e', this.wrapJavaScriptCode(code, testSuite)],
      },
      [Language.TYPESCRIPT]: {
        image: 'node:18-alpine',
        cmd: [
          'sh',
          '-c',
          `npm install -g ts-node && ts-node -e "${this.escapeForShell(this.wrapTypeScriptCode(code, testSuite))}"`,
        ],
      },
      [Language.PYTHON]: {
        image: 'python:3.11-alpine',
        cmd: ['python', '-c', this.wrapPythonCode(code, testSuite)],
      },
      [Language.JAVA]: {
        image: 'openjdk:17-alpine',
        cmd: ['sh', '-c', this.wrapJavaCode(code, testSuite)],
      },
      [Language.CPP]: {
        image: 'gcc:latest',
        cmd: ['sh', '-c', this.wrapCppCode(code, testSuite)],
      },
      [Language.HTML]: {
        image: 'node:18-alpine',
        cmd: ['node', '-e', this.wrapHtmlCode(code, testSuite)],
      },
      [Language.CSS]: {
        image: 'node:18-alpine',
        cmd: ['node', '-e', this.wrapCssCode(code, testSuite)],
      },
    };

    const config = configs[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    return {
      Image: config.image,
      Cmd: config.cmd,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        Memory: memoryLimit * 1024 * 1024, // Convert MB to bytes
        MemorySwap: memoryLimit * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: 50000, // 50% CPU
        NetworkMode: 'none',
        ReadonlyRootfs: true,
        SecurityOpt: ['no-new-privileges:true'],
        PidsLimit: 50,
      },
    };
  }

  private wrapJavaScriptCode(code: string, testSuite: string): string {
    return `
          ${code}
          
          // Exécuter les tests
          try {
            ${testSuite}
            
            // Si on arrive ici, tous les tests ont réussi
            console.log('{"status": "SUCCESS", "passed": true}');
          } catch (error) {
            const err = error instanceof Error ? error.message : String(error);
            console.error('{"status": "FAILED", "error": "' + err + '", "passed": false}');
          }
        `;
  }

  private wrapTypeScriptCode(code: string, testSuite: string): string {
    // Pour TypeScript, nous exécutons directement avec ts-node
    return this.wrapJavaScriptCode(code, testSuite);
  }

  private wrapPythonCode(code: string, testSuite: string): string {
    return `
    ${code}
    
    import sys
    import json
    
    try:
        ${testSuite}
        print('{"status": "SUCCESS", "passed": true}')
    except AssertionError as e:
        print(f'{{"status": "FAILED", "error": "{str(e)}", "passed": false}}')
    except Exception as e:
        print(f'{{"status": "ERROR", "error": "{str(e)}", "passed": false}}')
        `;
  }

  private wrapJavaCode(code: string, testSuite: string): string {
    const escapedCode = this.escapeForShell(code);
    const escapedTestSuite = this.escapeForShell(testSuite);

    return `
          echo "${escapedCode}" > Main.java &&
          echo "${escapedTestSuite}" > TestRunner.java &&
          javac Main.java TestRunner.java &&
          java TestRunner
        `;
  }

  private wrapCppCode(code: string, testSuite: string): string {
    const escapedCode = this.escapeForShell(code);
    const escapedTestSuite = this.escapeForShell(testSuite);

    return `
          echo "${escapedCode}" > main.cpp &&
          echo "${escapedTestSuite}" > test.cpp &&
          g++ main.cpp test.cpp -o program &&
          ./program
        `;
  }

  private wrapHtmlCode(code: string, testSuite: string): string {
    // Pour HTML, on vérifie la structure
    return `
          const html = \`${code.replace(/`/g, '\\`')}\`;
          ${testSuite}
          console.log('{"status": "SUCCESS", "passed": true}');
        `;
  }

  private wrapCssCode(code: string, testSuite: string): string {
    // Pour CSS, on vérifie les règles
    return `
          const css = \`${code.replace(/`/g, '\\`')}\`;
          ${testSuite}
          console.log('{"status": "SUCCESS", "passed": true}');
        `;
  }

  private escapeForShell(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\"'\"'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
  }

  private evaluateTestOutput(output: string): boolean {
    try {
      const jsonMatch = output.match(/\{.*\}/s);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]) as { passed?: boolean };
        return result.passed === true;
      }
      return (
        output.includes('SUCCESS') &&
        !output.includes('FAILED') &&
        !output.includes('ERROR')
      );
    } catch {
      return false;
    }
  }

  private parseTestResults(
    output: string,
  ): Array<{ name?: string; passed?: boolean; error?: string }> {
    try {
      const jsonMatch = output.match(/\{.*\}/s);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]) as {
          testResults?: Array<{
            name?: string;
            passed?: boolean;
            error?: string;
          }>;
        };
        return result.testResults ?? [];
      }
    } catch {
      // Ignorer les erreurs de parsing
    }
    return [];
  }

  private calculateExecutionTime(stats: ContainerStatsData): number {
    const cs = stats?.cpu_stats;
    const ps = stats?.precpu_stats;
    const cu = cs?.cpu_usage?.total_usage;
    const pu = ps?.cpu_usage?.total_usage;
    const su = cs?.system_cpu_usage;
    const sv = ps?.system_cpu_usage;

    if (
      cu === undefined ||
      pu === undefined ||
      su === undefined ||
      sv === undefined
    ) {
      return 0;
    }

    const cpuDelta = cu - pu;
    const systemDelta = su - sv;

    if (systemDelta === 0) {
      return 0;
    }

    return Math.round((cpuDelta / systemDelta) * 100);
  }

  private calculateMemoryUsage(stats: ContainerStatsData): number {
    const usage = stats?.memory_stats?.usage;

    if (usage === undefined) {
      return 0;
    }

    return Math.round(usage / 1024); // Convertir bytes en KB
  }
}
