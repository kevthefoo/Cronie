declare module 'sql.js' {
  interface Database {
    run(sql: string, params?: any[]): Database;
    exec(sql: string, params?: any[]): QueryExecResult[];
    each(sql: string, params: any[], callback: (row: any) => void, done: () => void): Database;
    prepare(sql: string, params?: any[]): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(params?: any): any;
    get(params?: any[]): any[];
    run(params?: any[]): void;
    reset(): void;
    free(): boolean;
  }

  interface SqlJsStatic {
    Database: {
      new (): Database;
      new (data: ArrayLike<number> | Buffer | null): Database;
    };
  }

  export type { Database, QueryExecResult, Statement };

  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}
