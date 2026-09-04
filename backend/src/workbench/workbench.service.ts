import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DbService } from '@src/db/db.service';
import { DockerService } from '@src/infrastructure/docker.service';
import { ResourceType } from '@generated/client';
import type {
  DatabaseDriver,
  DatabaseSchema,
  PaginatedRows,
  PaginationOptions,
  QueryResult,
  TableObject,
} from '@src/common/types/workbench';
import {
  MONGO_QUERY_WHITELIST,
  SQL_QUERY_WHITELIST,
} from '@src/common/types/workbench';
import { INTERNAL_PORT } from '@src/common/types/resource';
import { PostgresDriver, MysqlDriver, MongoDriver } from './drivers';

const DRIVER_MAP: Record<
  Exclude<ResourceType, 'redis'>,
  new (credentials: Record<string, string>) => DatabaseDriver
> = {
  [ResourceType.postgres]: PostgresDriver,
  [ResourceType.mysql]: MysqlDriver,
  [ResourceType.mongo]: MongoDriver,
};

@Injectable()
export class WorkbenchService {
  constructor(
    private readonly db: DbService,
    private readonly docker: DockerService,
  ) {}

  async getSchema(
    resourceId: string,
    userId: string,
  ): Promise<{ databases: DatabaseSchema[] }> {
    const resource = await this.verifyOwnershipAndType(resourceId, userId);
    const driver = this.createDriver(
      resource.type,
      await this.resolveConnectionCredentials(resource),
    );

    try {
      await driver.connect();
      const databases = await driver.listDatabases();
      const result: DatabaseSchema[] = [];

      for (const database of databases) {
        const tables = await driver.listTables(database);
        result.push({ name: database, objects: tables });
      }

      return { databases: result };
    } finally {
      await driver.close();
    }
  }

  async getTables(
    resourceId: string,
    userId: string,
  ): Promise<{ tables: TableObject[] }> {
    const resource = await this.verifyOwnershipAndType(resourceId, userId);
    const driver = this.createDriver(
      resource.type,
      await this.resolveConnectionCredentials(resource),
    );

    try {
      await driver.connect();
      const tables = await driver.listTables();
      return { tables };
    } finally {
      await driver.close();
    }
  }

  async getTableData(
    resourceId: string,
    userId: string,
    tableName: string,
    options: PaginationOptions,
  ): Promise<PaginatedRows> {
    const resource = await this.verifyOwnershipAndType(resourceId, userId);
    const driver = this.createDriver(
      resource.type,
      await this.resolveConnectionCredentials(resource),
    );

    try {
      await driver.connect();
      return await driver.paginateData(tableName, options);
    } finally {
      await driver.close();
    }
  }

  async executeQuery(
    resourceId: string,
    userId: string,
    query: string,
  ): Promise<QueryResult> {
    const resource = await this.verifyOwnershipAndType(resourceId, userId);
    this.enforceReadOnly(resource.type, query);

    const driver = this.createDriver(
      resource.type,
      await this.resolveConnectionCredentials(resource),
    );

    const withTimeout = async <T>(promise: Promise<T>) => {
      let timer: ReturnType<typeof setTimeout>;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new BadRequestException('Query timed out after 30s')),
          30_000,
        );
      });

      return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        timeoutPromise,
      ]);
    };

    try {
      await driver.connect();
      return await withTimeout(driver.execute(query));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error ? error.message : 'Query execution failed',
      );
    } finally {
      await driver.close();
    }
  }

  private async resolveConnectionCredentials(resource: {
    type: ResourceType;
    hostname: string | null;
    containerId: string | null;
    credentials: unknown;
  }): Promise<Record<string, string>> {
    const credentials = {
      ...(resource.credentials as Record<string, string>),
    };

    if (!resource.hostname || !resource.containerId) {
      return credentials;
    }

    const internalPort = INTERNAL_PORT[resource.type];
    const info = await this.docker.inspectContainer(resource.containerId);
    const hostPort =
      info.NetworkSettings?.Ports?.[`${internalPort}/tcp`]?.[0]?.HostPort;

    if (!hostPort) {
      return credentials;
    }

    for (const key of Object.keys(credentials)) {
      const upperKey = key.toUpperCase();

      if (upperKey.includes('URL') || upperKey.includes('URI')) {
        credentials[key] = credentials[key].replace(
          `${resource.hostname}:${internalPort}`,
          `127.0.0.1:${hostPort}`,
        );
      } else if (upperKey.includes('HOST')) {
        credentials[key] = '127.0.0.1';
      } else if (upperKey.includes('PORT')) {
        credentials[key] = hostPort;
      }
    }

    return credentials;
  }

  private createDriver(
    type: ResourceType,
    credentials: Record<string, string>,
  ): DatabaseDriver {
    const parsedType = type as Exclude<ResourceType, 'redis'>;
    const DriverClass = DRIVER_MAP[parsedType];

    if (!DriverClass) {
      throw new BadRequestException(`Unsupported resource type: ${type}`);
    }

    return new DriverClass(credentials);
  }

  private enforceReadOnly(type: ResourceType, query: string): void {
    const whitelist = this.getWhitelist(type);

    if (!whitelist.pattern.test(query)) {
      throw new BadRequestException(
        `Query not allowed. Workbench allows only ${whitelist.description}`,
      );
    }
  }

  private getWhitelist(type: ResourceType) {
    switch (type) {
      case ResourceType.postgres:
      case ResourceType.mysql:
        return SQL_QUERY_WHITELIST;
      case ResourceType.mongo:
        return MONGO_QUERY_WHITELIST;
      default:
        throw new BadRequestException(
          `Unsupported resource type: ${type as string}`,
        );
    }
  }

  private async verifyOwnershipAndType(resourceId: string, userId: string) {
    const resource = await this.db.resource.findUnique({
      where: {
        id: resourceId,
        environment: { project: { ownerId: userId } },
      },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (resource.type === ResourceType.redis) {
      throw new BadRequestException('Redis is not supported for workbench');
    }

    return resource;
  }
}
