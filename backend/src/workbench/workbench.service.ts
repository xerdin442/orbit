import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DbService } from '@src/db/db.service';
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
  REDIS_QUERY_WHITELIST,
  SQL_QUERY_WHITELIST,
} from '@src/common/types/workbench';
import {
  PostgresDriver,
  MysqlDriver,
  RedisDriver,
  MongoDriver,
} from './drivers';

const DRIVER_MAP: Record<
  ResourceType,
  new (credentials: Record<string, string>) => DatabaseDriver
> = {
  [ResourceType.postgres]: PostgresDriver,
  [ResourceType.mysql]: MysqlDriver,
  [ResourceType.redis]: RedisDriver,
  [ResourceType.mongo]: MongoDriver,
};

@Injectable()
export class WorkbenchService {
  constructor(private readonly db: DbService) {}

  async getSchema(
    resourceId: string,
    userId: string,
  ): Promise<{ databases: DatabaseSchema[] }> {
    const resource = await this.verifyOwnership(resourceId, userId);
    const driver = this.createDriver(
      resource.type,
      resource.credentials as Record<string, string>,
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
    const resource = await this.verifyOwnership(resourceId, userId);
    const driver = this.createDriver(
      resource.type,
      resource.credentials as Record<string, string>,
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
    const resource = await this.verifyOwnership(resourceId, userId);
    const driver = this.createDriver(
      resource.type,
      resource.credentials as Record<string, string>,
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
    const resource = await this.verifyOwnership(resourceId, userId);
    this.enforceReadOnly(resource.type, query);

    const driver = this.createDriver(
      resource.type,
      resource.credentials as Record<string, string>,
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

  private createDriver(
    type: ResourceType,
    credentials: Record<string, string>,
  ): DatabaseDriver {
    const DriverClass = DRIVER_MAP[type];

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
      case ResourceType.redis:
        return REDIS_QUERY_WHITELIST;
      case ResourceType.mongo:
        return MONGO_QUERY_WHITELIST;
      default:
        throw new BadRequestException(
          `Unsupported resource type: ${type as string}`,
        );
    }
  }

  private async verifyOwnership(resourceId: string, userId: string) {
    const resource = await this.db.resource.findUnique({
      where: {
        id: resourceId,
        environment: { project: { ownerId: userId } },
      },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    return resource;
  }
}
