
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Category
 * 
 */
export type Category = $Result.DefaultSelection<Prisma.$CategoryPayload>
/**
 * Model Product
 * 
 */
export type Product = $Result.DefaultSelection<Prisma.$ProductPayload>
/**
 * Model ModifierGroup
 * 
 */
export type ModifierGroup = $Result.DefaultSelection<Prisma.$ModifierGroupPayload>
/**
 * Model ModifierOption
 * 
 */
export type ModifierOption = $Result.DefaultSelection<Prisma.$ModifierOptionPayload>
/**
 * Model ProductModifierGroup
 * 
 */
export type ProductModifierGroup = $Result.DefaultSelection<Prisma.$ProductModifierGroupPayload>

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Categories
 * const categories = await prisma.category.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Categories
   * const categories = await prisma.category.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.category`: Exposes CRUD operations for the **Category** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Categories
    * const categories = await prisma.category.findMany()
    * ```
    */
  get category(): Prisma.CategoryDelegate<ExtArgs>;

  /**
   * `prisma.product`: Exposes CRUD operations for the **Product** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Products
    * const products = await prisma.product.findMany()
    * ```
    */
  get product(): Prisma.ProductDelegate<ExtArgs>;

  /**
   * `prisma.modifierGroup`: Exposes CRUD operations for the **ModifierGroup** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ModifierGroups
    * const modifierGroups = await prisma.modifierGroup.findMany()
    * ```
    */
  get modifierGroup(): Prisma.ModifierGroupDelegate<ExtArgs>;

  /**
   * `prisma.modifierOption`: Exposes CRUD operations for the **ModifierOption** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ModifierOptions
    * const modifierOptions = await prisma.modifierOption.findMany()
    * ```
    */
  get modifierOption(): Prisma.ModifierOptionDelegate<ExtArgs>;

  /**
   * `prisma.productModifierGroup`: Exposes CRUD operations for the **ProductModifierGroup** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ProductModifierGroups
    * const productModifierGroups = await prisma.productModifierGroup.findMany()
    * ```
    */
  get productModifierGroup(): Prisma.ProductModifierGroupDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.22.0
   * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Category: 'Category',
    Product: 'Product',
    ModifierGroup: 'ModifierGroup',
    ModifierOption: 'ModifierOption',
    ProductModifierGroup: 'ProductModifierGroup'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "category" | "product" | "modifierGroup" | "modifierOption" | "productModifierGroup"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Category: {
        payload: Prisma.$CategoryPayload<ExtArgs>
        fields: Prisma.CategoryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CategoryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CategoryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          findFirst: {
            args: Prisma.CategoryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CategoryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          findMany: {
            args: Prisma.CategoryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>[]
          }
          create: {
            args: Prisma.CategoryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          createMany: {
            args: Prisma.CategoryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CategoryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>[]
          }
          delete: {
            args: Prisma.CategoryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          update: {
            args: Prisma.CategoryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          deleteMany: {
            args: Prisma.CategoryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CategoryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.CategoryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          aggregate: {
            args: Prisma.CategoryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCategory>
          }
          groupBy: {
            args: Prisma.CategoryGroupByArgs<ExtArgs>
            result: $Utils.Optional<CategoryGroupByOutputType>[]
          }
          count: {
            args: Prisma.CategoryCountArgs<ExtArgs>
            result: $Utils.Optional<CategoryCountAggregateOutputType> | number
          }
        }
      }
      Product: {
        payload: Prisma.$ProductPayload<ExtArgs>
        fields: Prisma.ProductFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ProductFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ProductFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          findFirst: {
            args: Prisma.ProductFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ProductFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          findMany: {
            args: Prisma.ProductFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>[]
          }
          create: {
            args: Prisma.ProductCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          createMany: {
            args: Prisma.ProductCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ProductCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>[]
          }
          delete: {
            args: Prisma.ProductDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          update: {
            args: Prisma.ProductUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          deleteMany: {
            args: Prisma.ProductDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ProductUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ProductUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          aggregate: {
            args: Prisma.ProductAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateProduct>
          }
          groupBy: {
            args: Prisma.ProductGroupByArgs<ExtArgs>
            result: $Utils.Optional<ProductGroupByOutputType>[]
          }
          count: {
            args: Prisma.ProductCountArgs<ExtArgs>
            result: $Utils.Optional<ProductCountAggregateOutputType> | number
          }
        }
      }
      ModifierGroup: {
        payload: Prisma.$ModifierGroupPayload<ExtArgs>
        fields: Prisma.ModifierGroupFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ModifierGroupFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierGroupPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ModifierGroupFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierGroupPayload>
          }
          findFirst: {
            args: Prisma.ModifierGroupFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierGroupPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ModifierGroupFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierGroupPayload>
          }
          findMany: {
            args: Prisma.ModifierGroupFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierGroupPayload>[]
          }
          create: {
            args: Prisma.ModifierGroupCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierGroupPayload>
          }
          createMany: {
            args: Prisma.ModifierGroupCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ModifierGroupCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierGroupPayload>[]
          }
          delete: {
            args: Prisma.ModifierGroupDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierGroupPayload>
          }
          update: {
            args: Prisma.ModifierGroupUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierGroupPayload>
          }
          deleteMany: {
            args: Prisma.ModifierGroupDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ModifierGroupUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ModifierGroupUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierGroupPayload>
          }
          aggregate: {
            args: Prisma.ModifierGroupAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateModifierGroup>
          }
          groupBy: {
            args: Prisma.ModifierGroupGroupByArgs<ExtArgs>
            result: $Utils.Optional<ModifierGroupGroupByOutputType>[]
          }
          count: {
            args: Prisma.ModifierGroupCountArgs<ExtArgs>
            result: $Utils.Optional<ModifierGroupCountAggregateOutputType> | number
          }
        }
      }
      ModifierOption: {
        payload: Prisma.$ModifierOptionPayload<ExtArgs>
        fields: Prisma.ModifierOptionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ModifierOptionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierOptionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ModifierOptionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierOptionPayload>
          }
          findFirst: {
            args: Prisma.ModifierOptionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierOptionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ModifierOptionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierOptionPayload>
          }
          findMany: {
            args: Prisma.ModifierOptionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierOptionPayload>[]
          }
          create: {
            args: Prisma.ModifierOptionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierOptionPayload>
          }
          createMany: {
            args: Prisma.ModifierOptionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ModifierOptionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierOptionPayload>[]
          }
          delete: {
            args: Prisma.ModifierOptionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierOptionPayload>
          }
          update: {
            args: Prisma.ModifierOptionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierOptionPayload>
          }
          deleteMany: {
            args: Prisma.ModifierOptionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ModifierOptionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ModifierOptionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ModifierOptionPayload>
          }
          aggregate: {
            args: Prisma.ModifierOptionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateModifierOption>
          }
          groupBy: {
            args: Prisma.ModifierOptionGroupByArgs<ExtArgs>
            result: $Utils.Optional<ModifierOptionGroupByOutputType>[]
          }
          count: {
            args: Prisma.ModifierOptionCountArgs<ExtArgs>
            result: $Utils.Optional<ModifierOptionCountAggregateOutputType> | number
          }
        }
      }
      ProductModifierGroup: {
        payload: Prisma.$ProductModifierGroupPayload<ExtArgs>
        fields: Prisma.ProductModifierGroupFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ProductModifierGroupFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductModifierGroupPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ProductModifierGroupFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductModifierGroupPayload>
          }
          findFirst: {
            args: Prisma.ProductModifierGroupFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductModifierGroupPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ProductModifierGroupFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductModifierGroupPayload>
          }
          findMany: {
            args: Prisma.ProductModifierGroupFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductModifierGroupPayload>[]
          }
          create: {
            args: Prisma.ProductModifierGroupCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductModifierGroupPayload>
          }
          createMany: {
            args: Prisma.ProductModifierGroupCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ProductModifierGroupCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductModifierGroupPayload>[]
          }
          delete: {
            args: Prisma.ProductModifierGroupDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductModifierGroupPayload>
          }
          update: {
            args: Prisma.ProductModifierGroupUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductModifierGroupPayload>
          }
          deleteMany: {
            args: Prisma.ProductModifierGroupDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ProductModifierGroupUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ProductModifierGroupUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductModifierGroupPayload>
          }
          aggregate: {
            args: Prisma.ProductModifierGroupAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateProductModifierGroup>
          }
          groupBy: {
            args: Prisma.ProductModifierGroupGroupByArgs<ExtArgs>
            result: $Utils.Optional<ProductModifierGroupGroupByOutputType>[]
          }
          count: {
            args: Prisma.ProductModifierGroupCountArgs<ExtArgs>
            result: $Utils.Optional<ProductModifierGroupCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  }


  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type CategoryCountOutputType
   */

  export type CategoryCountOutputType = {
    products: number
  }

  export type CategoryCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    products?: boolean | CategoryCountOutputTypeCountProductsArgs
  }

  // Custom InputTypes
  /**
   * CategoryCountOutputType without action
   */
  export type CategoryCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryCountOutputType
     */
    select?: CategoryCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * CategoryCountOutputType without action
   */
  export type CategoryCountOutputTypeCountProductsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ProductWhereInput
  }


  /**
   * Count Type ProductCountOutputType
   */

  export type ProductCountOutputType = {
    modifierGroups: number
  }

  export type ProductCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    modifierGroups?: boolean | ProductCountOutputTypeCountModifierGroupsArgs
  }

  // Custom InputTypes
  /**
   * ProductCountOutputType without action
   */
  export type ProductCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductCountOutputType
     */
    select?: ProductCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ProductCountOutputType without action
   */
  export type ProductCountOutputTypeCountModifierGroupsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ProductModifierGroupWhereInput
  }


  /**
   * Count Type ModifierGroupCountOutputType
   */

  export type ModifierGroupCountOutputType = {
    options: number
    products: number
  }

  export type ModifierGroupCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    options?: boolean | ModifierGroupCountOutputTypeCountOptionsArgs
    products?: boolean | ModifierGroupCountOutputTypeCountProductsArgs
  }

  // Custom InputTypes
  /**
   * ModifierGroupCountOutputType without action
   */
  export type ModifierGroupCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroupCountOutputType
     */
    select?: ModifierGroupCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ModifierGroupCountOutputType without action
   */
  export type ModifierGroupCountOutputTypeCountOptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ModifierOptionWhereInput
  }

  /**
   * ModifierGroupCountOutputType without action
   */
  export type ModifierGroupCountOutputTypeCountProductsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ProductModifierGroupWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Category
   */

  export type AggregateCategory = {
    _count: CategoryCountAggregateOutputType | null
    _avg: CategoryAvgAggregateOutputType | null
    _sum: CategorySumAggregateOutputType | null
    _min: CategoryMinAggregateOutputType | null
    _max: CategoryMaxAggregateOutputType | null
  }

  export type CategoryAvgAggregateOutputType = {
    sortOrder: number | null
  }

  export type CategorySumAggregateOutputType = {
    sortOrder: number | null
  }

  export type CategoryMinAggregateOutputType = {
    id: string | null
    tenantId: string | null
    name: string | null
    sortOrder: number | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CategoryMaxAggregateOutputType = {
    id: string | null
    tenantId: string | null
    name: string | null
    sortOrder: number | null
    isActive: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CategoryCountAggregateOutputType = {
    id: number
    tenantId: number
    name: number
    sortOrder: number
    isActive: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CategoryAvgAggregateInputType = {
    sortOrder?: true
  }

  export type CategorySumAggregateInputType = {
    sortOrder?: true
  }

  export type CategoryMinAggregateInputType = {
    id?: true
    tenantId?: true
    name?: true
    sortOrder?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CategoryMaxAggregateInputType = {
    id?: true
    tenantId?: true
    name?: true
    sortOrder?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CategoryCountAggregateInputType = {
    id?: true
    tenantId?: true
    name?: true
    sortOrder?: true
    isActive?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CategoryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Category to aggregate.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Categories
    **/
    _count?: true | CategoryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CategoryAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CategorySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CategoryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CategoryMaxAggregateInputType
  }

  export type GetCategoryAggregateType<T extends CategoryAggregateArgs> = {
        [P in keyof T & keyof AggregateCategory]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCategory[P]>
      : GetScalarType<T[P], AggregateCategory[P]>
  }




  export type CategoryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CategoryWhereInput
    orderBy?: CategoryOrderByWithAggregationInput | CategoryOrderByWithAggregationInput[]
    by: CategoryScalarFieldEnum[] | CategoryScalarFieldEnum
    having?: CategoryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CategoryCountAggregateInputType | true
    _avg?: CategoryAvgAggregateInputType
    _sum?: CategorySumAggregateInputType
    _min?: CategoryMinAggregateInputType
    _max?: CategoryMaxAggregateInputType
  }

  export type CategoryGroupByOutputType = {
    id: string
    tenantId: string
    name: string
    sortOrder: number
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: CategoryCountAggregateOutputType | null
    _avg: CategoryAvgAggregateOutputType | null
    _sum: CategorySumAggregateOutputType | null
    _min: CategoryMinAggregateOutputType | null
    _max: CategoryMaxAggregateOutputType | null
  }

  type GetCategoryGroupByPayload<T extends CategoryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CategoryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CategoryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CategoryGroupByOutputType[P]>
            : GetScalarType<T[P], CategoryGroupByOutputType[P]>
        }
      >
    >


  export type CategorySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantId?: boolean
    name?: boolean
    sortOrder?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    products?: boolean | Category$productsArgs<ExtArgs>
    _count?: boolean | CategoryCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["category"]>

  export type CategorySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantId?: boolean
    name?: boolean
    sortOrder?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["category"]>

  export type CategorySelectScalar = {
    id?: boolean
    tenantId?: boolean
    name?: boolean
    sortOrder?: boolean
    isActive?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CategoryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    products?: boolean | Category$productsArgs<ExtArgs>
    _count?: boolean | CategoryCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type CategoryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $CategoryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Category"
    objects: {
      products: Prisma.$ProductPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      tenantId: string
      name: string
      sortOrder: number
      isActive: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["category"]>
    composites: {}
  }

  type CategoryGetPayload<S extends boolean | null | undefined | CategoryDefaultArgs> = $Result.GetResult<Prisma.$CategoryPayload, S>

  type CategoryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<CategoryFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: CategoryCountAggregateInputType | true
    }

  export interface CategoryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Category'], meta: { name: 'Category' } }
    /**
     * Find zero or one Category that matches the filter.
     * @param {CategoryFindUniqueArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CategoryFindUniqueArgs>(args: SelectSubset<T, CategoryFindUniqueArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Category that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {CategoryFindUniqueOrThrowArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CategoryFindUniqueOrThrowArgs>(args: SelectSubset<T, CategoryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Category that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindFirstArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CategoryFindFirstArgs>(args?: SelectSubset<T, CategoryFindFirstArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Category that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindFirstOrThrowArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CategoryFindFirstOrThrowArgs>(args?: SelectSubset<T, CategoryFindFirstOrThrowArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Categories that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Categories
     * const categories = await prisma.category.findMany()
     * 
     * // Get first 10 Categories
     * const categories = await prisma.category.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const categoryWithIdOnly = await prisma.category.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CategoryFindManyArgs>(args?: SelectSubset<T, CategoryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Category.
     * @param {CategoryCreateArgs} args - Arguments to create a Category.
     * @example
     * // Create one Category
     * const Category = await prisma.category.create({
     *   data: {
     *     // ... data to create a Category
     *   }
     * })
     * 
     */
    create<T extends CategoryCreateArgs>(args: SelectSubset<T, CategoryCreateArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Categories.
     * @param {CategoryCreateManyArgs} args - Arguments to create many Categories.
     * @example
     * // Create many Categories
     * const category = await prisma.category.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CategoryCreateManyArgs>(args?: SelectSubset<T, CategoryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Categories and returns the data saved in the database.
     * @param {CategoryCreateManyAndReturnArgs} args - Arguments to create many Categories.
     * @example
     * // Create many Categories
     * const category = await prisma.category.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Categories and only return the `id`
     * const categoryWithIdOnly = await prisma.category.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CategoryCreateManyAndReturnArgs>(args?: SelectSubset<T, CategoryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Category.
     * @param {CategoryDeleteArgs} args - Arguments to delete one Category.
     * @example
     * // Delete one Category
     * const Category = await prisma.category.delete({
     *   where: {
     *     // ... filter to delete one Category
     *   }
     * })
     * 
     */
    delete<T extends CategoryDeleteArgs>(args: SelectSubset<T, CategoryDeleteArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Category.
     * @param {CategoryUpdateArgs} args - Arguments to update one Category.
     * @example
     * // Update one Category
     * const category = await prisma.category.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CategoryUpdateArgs>(args: SelectSubset<T, CategoryUpdateArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Categories.
     * @param {CategoryDeleteManyArgs} args - Arguments to filter Categories to delete.
     * @example
     * // Delete a few Categories
     * const { count } = await prisma.category.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CategoryDeleteManyArgs>(args?: SelectSubset<T, CategoryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Categories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Categories
     * const category = await prisma.category.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CategoryUpdateManyArgs>(args: SelectSubset<T, CategoryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Category.
     * @param {CategoryUpsertArgs} args - Arguments to update or create a Category.
     * @example
     * // Update or create a Category
     * const category = await prisma.category.upsert({
     *   create: {
     *     // ... data to create a Category
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Category we want to update
     *   }
     * })
     */
    upsert<T extends CategoryUpsertArgs>(args: SelectSubset<T, CategoryUpsertArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Categories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryCountArgs} args - Arguments to filter Categories to count.
     * @example
     * // Count the number of Categories
     * const count = await prisma.category.count({
     *   where: {
     *     // ... the filter for the Categories we want to count
     *   }
     * })
    **/
    count<T extends CategoryCountArgs>(
      args?: Subset<T, CategoryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CategoryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Category.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CategoryAggregateArgs>(args: Subset<T, CategoryAggregateArgs>): Prisma.PrismaPromise<GetCategoryAggregateType<T>>

    /**
     * Group by Category.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CategoryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CategoryGroupByArgs['orderBy'] }
        : { orderBy?: CategoryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CategoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCategoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Category model
   */
  readonly fields: CategoryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Category.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CategoryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    products<T extends Category$productsArgs<ExtArgs> = {}>(args?: Subset<T, Category$productsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Category model
   */ 
  interface CategoryFieldRefs {
    readonly id: FieldRef<"Category", 'String'>
    readonly tenantId: FieldRef<"Category", 'String'>
    readonly name: FieldRef<"Category", 'String'>
    readonly sortOrder: FieldRef<"Category", 'Int'>
    readonly isActive: FieldRef<"Category", 'Boolean'>
    readonly createdAt: FieldRef<"Category", 'DateTime'>
    readonly updatedAt: FieldRef<"Category", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Category findUnique
   */
  export type CategoryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category findUniqueOrThrow
   */
  export type CategoryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category findFirst
   */
  export type CategoryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Categories.
     */
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }

  /**
   * Category findFirstOrThrow
   */
  export type CategoryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Categories.
     */
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }

  /**
   * Category findMany
   */
  export type CategoryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Categories to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }

  /**
   * Category create
   */
  export type CategoryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The data needed to create a Category.
     */
    data: XOR<CategoryCreateInput, CategoryUncheckedCreateInput>
  }

  /**
   * Category createMany
   */
  export type CategoryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Categories.
     */
    data: CategoryCreateManyInput | CategoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Category createManyAndReturn
   */
  export type CategoryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Categories.
     */
    data: CategoryCreateManyInput | CategoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Category update
   */
  export type CategoryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The data needed to update a Category.
     */
    data: XOR<CategoryUpdateInput, CategoryUncheckedUpdateInput>
    /**
     * Choose, which Category to update.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category updateMany
   */
  export type CategoryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Categories.
     */
    data: XOR<CategoryUpdateManyMutationInput, CategoryUncheckedUpdateManyInput>
    /**
     * Filter which Categories to update
     */
    where?: CategoryWhereInput
  }

  /**
   * Category upsert
   */
  export type CategoryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The filter to search for the Category to update in case it exists.
     */
    where: CategoryWhereUniqueInput
    /**
     * In case the Category found by the `where` argument doesn't exist, create a new Category with this data.
     */
    create: XOR<CategoryCreateInput, CategoryUncheckedCreateInput>
    /**
     * In case the Category was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CategoryUpdateInput, CategoryUncheckedUpdateInput>
  }

  /**
   * Category delete
   */
  export type CategoryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter which Category to delete.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category deleteMany
   */
  export type CategoryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Categories to delete
     */
    where?: CategoryWhereInput
  }

  /**
   * Category.products
   */
  export type Category$productsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductInclude<ExtArgs> | null
    where?: ProductWhereInput
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    cursor?: ProductWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }

  /**
   * Category without action
   */
  export type CategoryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
  }


  /**
   * Model Product
   */

  export type AggregateProduct = {
    _count: ProductCountAggregateOutputType | null
    _avg: ProductAvgAggregateOutputType | null
    _sum: ProductSumAggregateOutputType | null
    _min: ProductMinAggregateOutputType | null
    _max: ProductMaxAggregateOutputType | null
  }

  export type ProductAvgAggregateOutputType = {
    price: Decimal | null
    sortOrder: number | null
    prepTimeMinutes: number | null
  }

  export type ProductSumAggregateOutputType = {
    price: Decimal | null
    sortOrder: number | null
    prepTimeMinutes: number | null
  }

  export type ProductMinAggregateOutputType = {
    id: string | null
    tenantId: string | null
    categoryId: string | null
    name: string | null
    description: string | null
    price: Decimal | null
    imageUrl: string | null
    isAvailable: boolean | null
    sortOrder: number | null
    prepTimeMinutes: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ProductMaxAggregateOutputType = {
    id: string | null
    tenantId: string | null
    categoryId: string | null
    name: string | null
    description: string | null
    price: Decimal | null
    imageUrl: string | null
    isAvailable: boolean | null
    sortOrder: number | null
    prepTimeMinutes: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ProductCountAggregateOutputType = {
    id: number
    tenantId: number
    categoryId: number
    name: number
    description: number
    price: number
    imageUrl: number
    isAvailable: number
    sortOrder: number
    prepTimeMinutes: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ProductAvgAggregateInputType = {
    price?: true
    sortOrder?: true
    prepTimeMinutes?: true
  }

  export type ProductSumAggregateInputType = {
    price?: true
    sortOrder?: true
    prepTimeMinutes?: true
  }

  export type ProductMinAggregateInputType = {
    id?: true
    tenantId?: true
    categoryId?: true
    name?: true
    description?: true
    price?: true
    imageUrl?: true
    isAvailable?: true
    sortOrder?: true
    prepTimeMinutes?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ProductMaxAggregateInputType = {
    id?: true
    tenantId?: true
    categoryId?: true
    name?: true
    description?: true
    price?: true
    imageUrl?: true
    isAvailable?: true
    sortOrder?: true
    prepTimeMinutes?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ProductCountAggregateInputType = {
    id?: true
    tenantId?: true
    categoryId?: true
    name?: true
    description?: true
    price?: true
    imageUrl?: true
    isAvailable?: true
    sortOrder?: true
    prepTimeMinutes?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ProductAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Product to aggregate.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Products
    **/
    _count?: true | ProductCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ProductAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ProductSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ProductMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ProductMaxAggregateInputType
  }

  export type GetProductAggregateType<T extends ProductAggregateArgs> = {
        [P in keyof T & keyof AggregateProduct]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateProduct[P]>
      : GetScalarType<T[P], AggregateProduct[P]>
  }




  export type ProductGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ProductWhereInput
    orderBy?: ProductOrderByWithAggregationInput | ProductOrderByWithAggregationInput[]
    by: ProductScalarFieldEnum[] | ProductScalarFieldEnum
    having?: ProductScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ProductCountAggregateInputType | true
    _avg?: ProductAvgAggregateInputType
    _sum?: ProductSumAggregateInputType
    _min?: ProductMinAggregateInputType
    _max?: ProductMaxAggregateInputType
  }

  export type ProductGroupByOutputType = {
    id: string
    tenantId: string
    categoryId: string
    name: string
    description: string | null
    price: Decimal
    imageUrl: string | null
    isAvailable: boolean
    sortOrder: number
    prepTimeMinutes: number | null
    createdAt: Date
    updatedAt: Date
    _count: ProductCountAggregateOutputType | null
    _avg: ProductAvgAggregateOutputType | null
    _sum: ProductSumAggregateOutputType | null
    _min: ProductMinAggregateOutputType | null
    _max: ProductMaxAggregateOutputType | null
  }

  type GetProductGroupByPayload<T extends ProductGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ProductGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ProductGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ProductGroupByOutputType[P]>
            : GetScalarType<T[P], ProductGroupByOutputType[P]>
        }
      >
    >


  export type ProductSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantId?: boolean
    categoryId?: boolean
    name?: boolean
    description?: boolean
    price?: boolean
    imageUrl?: boolean
    isAvailable?: boolean
    sortOrder?: boolean
    prepTimeMinutes?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | CategoryDefaultArgs<ExtArgs>
    modifierGroups?: boolean | Product$modifierGroupsArgs<ExtArgs>
    _count?: boolean | ProductCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["product"]>

  export type ProductSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantId?: boolean
    categoryId?: boolean
    name?: boolean
    description?: boolean
    price?: boolean
    imageUrl?: boolean
    isAvailable?: boolean
    sortOrder?: boolean
    prepTimeMinutes?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["product"]>

  export type ProductSelectScalar = {
    id?: boolean
    tenantId?: boolean
    categoryId?: boolean
    name?: boolean
    description?: boolean
    price?: boolean
    imageUrl?: boolean
    isAvailable?: boolean
    sortOrder?: boolean
    prepTimeMinutes?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ProductInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryDefaultArgs<ExtArgs>
    modifierGroups?: boolean | Product$modifierGroupsArgs<ExtArgs>
    _count?: boolean | ProductCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ProductIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }

  export type $ProductPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Product"
    objects: {
      category: Prisma.$CategoryPayload<ExtArgs>
      modifierGroups: Prisma.$ProductModifierGroupPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      tenantId: string
      categoryId: string
      name: string
      description: string | null
      price: Prisma.Decimal
      imageUrl: string | null
      isAvailable: boolean
      sortOrder: number
      prepTimeMinutes: number | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["product"]>
    composites: {}
  }

  type ProductGetPayload<S extends boolean | null | undefined | ProductDefaultArgs> = $Result.GetResult<Prisma.$ProductPayload, S>

  type ProductCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ProductFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ProductCountAggregateInputType | true
    }

  export interface ProductDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Product'], meta: { name: 'Product' } }
    /**
     * Find zero or one Product that matches the filter.
     * @param {ProductFindUniqueArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ProductFindUniqueArgs>(args: SelectSubset<T, ProductFindUniqueArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Product that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ProductFindUniqueOrThrowArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ProductFindUniqueOrThrowArgs>(args: SelectSubset<T, ProductFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Product that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductFindFirstArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ProductFindFirstArgs>(args?: SelectSubset<T, ProductFindFirstArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Product that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductFindFirstOrThrowArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ProductFindFirstOrThrowArgs>(args?: SelectSubset<T, ProductFindFirstOrThrowArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Products that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Products
     * const products = await prisma.product.findMany()
     * 
     * // Get first 10 Products
     * const products = await prisma.product.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const productWithIdOnly = await prisma.product.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ProductFindManyArgs>(args?: SelectSubset<T, ProductFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Product.
     * @param {ProductCreateArgs} args - Arguments to create a Product.
     * @example
     * // Create one Product
     * const Product = await prisma.product.create({
     *   data: {
     *     // ... data to create a Product
     *   }
     * })
     * 
     */
    create<T extends ProductCreateArgs>(args: SelectSubset<T, ProductCreateArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Products.
     * @param {ProductCreateManyArgs} args - Arguments to create many Products.
     * @example
     * // Create many Products
     * const product = await prisma.product.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ProductCreateManyArgs>(args?: SelectSubset<T, ProductCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Products and returns the data saved in the database.
     * @param {ProductCreateManyAndReturnArgs} args - Arguments to create many Products.
     * @example
     * // Create many Products
     * const product = await prisma.product.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Products and only return the `id`
     * const productWithIdOnly = await prisma.product.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ProductCreateManyAndReturnArgs>(args?: SelectSubset<T, ProductCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Product.
     * @param {ProductDeleteArgs} args - Arguments to delete one Product.
     * @example
     * // Delete one Product
     * const Product = await prisma.product.delete({
     *   where: {
     *     // ... filter to delete one Product
     *   }
     * })
     * 
     */
    delete<T extends ProductDeleteArgs>(args: SelectSubset<T, ProductDeleteArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Product.
     * @param {ProductUpdateArgs} args - Arguments to update one Product.
     * @example
     * // Update one Product
     * const product = await prisma.product.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ProductUpdateArgs>(args: SelectSubset<T, ProductUpdateArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Products.
     * @param {ProductDeleteManyArgs} args - Arguments to filter Products to delete.
     * @example
     * // Delete a few Products
     * const { count } = await prisma.product.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ProductDeleteManyArgs>(args?: SelectSubset<T, ProductDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Products.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Products
     * const product = await prisma.product.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ProductUpdateManyArgs>(args: SelectSubset<T, ProductUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Product.
     * @param {ProductUpsertArgs} args - Arguments to update or create a Product.
     * @example
     * // Update or create a Product
     * const product = await prisma.product.upsert({
     *   create: {
     *     // ... data to create a Product
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Product we want to update
     *   }
     * })
     */
    upsert<T extends ProductUpsertArgs>(args: SelectSubset<T, ProductUpsertArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Products.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductCountArgs} args - Arguments to filter Products to count.
     * @example
     * // Count the number of Products
     * const count = await prisma.product.count({
     *   where: {
     *     // ... the filter for the Products we want to count
     *   }
     * })
    **/
    count<T extends ProductCountArgs>(
      args?: Subset<T, ProductCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ProductCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Product.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ProductAggregateArgs>(args: Subset<T, ProductAggregateArgs>): Prisma.PrismaPromise<GetProductAggregateType<T>>

    /**
     * Group by Product.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ProductGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ProductGroupByArgs['orderBy'] }
        : { orderBy?: ProductGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ProductGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetProductGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Product model
   */
  readonly fields: ProductFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Product.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ProductClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    category<T extends CategoryDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CategoryDefaultArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    modifierGroups<T extends Product$modifierGroupsArgs<ExtArgs> = {}>(args?: Subset<T, Product$modifierGroupsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Product model
   */ 
  interface ProductFieldRefs {
    readonly id: FieldRef<"Product", 'String'>
    readonly tenantId: FieldRef<"Product", 'String'>
    readonly categoryId: FieldRef<"Product", 'String'>
    readonly name: FieldRef<"Product", 'String'>
    readonly description: FieldRef<"Product", 'String'>
    readonly price: FieldRef<"Product", 'Decimal'>
    readonly imageUrl: FieldRef<"Product", 'String'>
    readonly isAvailable: FieldRef<"Product", 'Boolean'>
    readonly sortOrder: FieldRef<"Product", 'Int'>
    readonly prepTimeMinutes: FieldRef<"Product", 'Int'>
    readonly createdAt: FieldRef<"Product", 'DateTime'>
    readonly updatedAt: FieldRef<"Product", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Product findUnique
   */
  export type ProductFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where: ProductWhereUniqueInput
  }

  /**
   * Product findUniqueOrThrow
   */
  export type ProductFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where: ProductWhereUniqueInput
  }

  /**
   * Product findFirst
   */
  export type ProductFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Products.
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Products.
     */
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }

  /**
   * Product findFirstOrThrow
   */
  export type ProductFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Products.
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Products.
     */
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }

  /**
   * Product findMany
   */
  export type ProductFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter, which Products to fetch.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Products.
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }

  /**
   * Product create
   */
  export type ProductCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * The data needed to create a Product.
     */
    data: XOR<ProductCreateInput, ProductUncheckedCreateInput>
  }

  /**
   * Product createMany
   */
  export type ProductCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Products.
     */
    data: ProductCreateManyInput | ProductCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Product createManyAndReturn
   */
  export type ProductCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Products.
     */
    data: ProductCreateManyInput | ProductCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Product update
   */
  export type ProductUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * The data needed to update a Product.
     */
    data: XOR<ProductUpdateInput, ProductUncheckedUpdateInput>
    /**
     * Choose, which Product to update.
     */
    where: ProductWhereUniqueInput
  }

  /**
   * Product updateMany
   */
  export type ProductUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Products.
     */
    data: XOR<ProductUpdateManyMutationInput, ProductUncheckedUpdateManyInput>
    /**
     * Filter which Products to update
     */
    where?: ProductWhereInput
  }

  /**
   * Product upsert
   */
  export type ProductUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * The filter to search for the Product to update in case it exists.
     */
    where: ProductWhereUniqueInput
    /**
     * In case the Product found by the `where` argument doesn't exist, create a new Product with this data.
     */
    create: XOR<ProductCreateInput, ProductUncheckedCreateInput>
    /**
     * In case the Product was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ProductUpdateInput, ProductUncheckedUpdateInput>
  }

  /**
   * Product delete
   */
  export type ProductDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter which Product to delete.
     */
    where: ProductWhereUniqueInput
  }

  /**
   * Product deleteMany
   */
  export type ProductDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Products to delete
     */
    where?: ProductWhereInput
  }

  /**
   * Product.modifierGroups
   */
  export type Product$modifierGroupsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
    where?: ProductModifierGroupWhereInput
    orderBy?: ProductModifierGroupOrderByWithRelationInput | ProductModifierGroupOrderByWithRelationInput[]
    cursor?: ProductModifierGroupWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ProductModifierGroupScalarFieldEnum | ProductModifierGroupScalarFieldEnum[]
  }

  /**
   * Product without action
   */
  export type ProductDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductInclude<ExtArgs> | null
  }


  /**
   * Model ModifierGroup
   */

  export type AggregateModifierGroup = {
    _count: ModifierGroupCountAggregateOutputType | null
    _avg: ModifierGroupAvgAggregateOutputType | null
    _sum: ModifierGroupSumAggregateOutputType | null
    _min: ModifierGroupMinAggregateOutputType | null
    _max: ModifierGroupMaxAggregateOutputType | null
  }

  export type ModifierGroupAvgAggregateOutputType = {
    minSelections: number | null
    maxSelections: number | null
  }

  export type ModifierGroupSumAggregateOutputType = {
    minSelections: number | null
    maxSelections: number | null
  }

  export type ModifierGroupMinAggregateOutputType = {
    id: string | null
    tenantId: string | null
    name: string | null
    minSelections: number | null
    maxSelections: number | null
    isRequired: boolean | null
  }

  export type ModifierGroupMaxAggregateOutputType = {
    id: string | null
    tenantId: string | null
    name: string | null
    minSelections: number | null
    maxSelections: number | null
    isRequired: boolean | null
  }

  export type ModifierGroupCountAggregateOutputType = {
    id: number
    tenantId: number
    name: number
    minSelections: number
    maxSelections: number
    isRequired: number
    _all: number
  }


  export type ModifierGroupAvgAggregateInputType = {
    minSelections?: true
    maxSelections?: true
  }

  export type ModifierGroupSumAggregateInputType = {
    minSelections?: true
    maxSelections?: true
  }

  export type ModifierGroupMinAggregateInputType = {
    id?: true
    tenantId?: true
    name?: true
    minSelections?: true
    maxSelections?: true
    isRequired?: true
  }

  export type ModifierGroupMaxAggregateInputType = {
    id?: true
    tenantId?: true
    name?: true
    minSelections?: true
    maxSelections?: true
    isRequired?: true
  }

  export type ModifierGroupCountAggregateInputType = {
    id?: true
    tenantId?: true
    name?: true
    minSelections?: true
    maxSelections?: true
    isRequired?: true
    _all?: true
  }

  export type ModifierGroupAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ModifierGroup to aggregate.
     */
    where?: ModifierGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModifierGroups to fetch.
     */
    orderBy?: ModifierGroupOrderByWithRelationInput | ModifierGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ModifierGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModifierGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModifierGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ModifierGroups
    **/
    _count?: true | ModifierGroupCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ModifierGroupAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ModifierGroupSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ModifierGroupMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ModifierGroupMaxAggregateInputType
  }

  export type GetModifierGroupAggregateType<T extends ModifierGroupAggregateArgs> = {
        [P in keyof T & keyof AggregateModifierGroup]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateModifierGroup[P]>
      : GetScalarType<T[P], AggregateModifierGroup[P]>
  }




  export type ModifierGroupGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ModifierGroupWhereInput
    orderBy?: ModifierGroupOrderByWithAggregationInput | ModifierGroupOrderByWithAggregationInput[]
    by: ModifierGroupScalarFieldEnum[] | ModifierGroupScalarFieldEnum
    having?: ModifierGroupScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ModifierGroupCountAggregateInputType | true
    _avg?: ModifierGroupAvgAggregateInputType
    _sum?: ModifierGroupSumAggregateInputType
    _min?: ModifierGroupMinAggregateInputType
    _max?: ModifierGroupMaxAggregateInputType
  }

  export type ModifierGroupGroupByOutputType = {
    id: string
    tenantId: string
    name: string
    minSelections: number
    maxSelections: number
    isRequired: boolean
    _count: ModifierGroupCountAggregateOutputType | null
    _avg: ModifierGroupAvgAggregateOutputType | null
    _sum: ModifierGroupSumAggregateOutputType | null
    _min: ModifierGroupMinAggregateOutputType | null
    _max: ModifierGroupMaxAggregateOutputType | null
  }

  type GetModifierGroupGroupByPayload<T extends ModifierGroupGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ModifierGroupGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ModifierGroupGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ModifierGroupGroupByOutputType[P]>
            : GetScalarType<T[P], ModifierGroupGroupByOutputType[P]>
        }
      >
    >


  export type ModifierGroupSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantId?: boolean
    name?: boolean
    minSelections?: boolean
    maxSelections?: boolean
    isRequired?: boolean
    options?: boolean | ModifierGroup$optionsArgs<ExtArgs>
    products?: boolean | ModifierGroup$productsArgs<ExtArgs>
    _count?: boolean | ModifierGroupCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["modifierGroup"]>

  export type ModifierGroupSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tenantId?: boolean
    name?: boolean
    minSelections?: boolean
    maxSelections?: boolean
    isRequired?: boolean
  }, ExtArgs["result"]["modifierGroup"]>

  export type ModifierGroupSelectScalar = {
    id?: boolean
    tenantId?: boolean
    name?: boolean
    minSelections?: boolean
    maxSelections?: boolean
    isRequired?: boolean
  }

  export type ModifierGroupInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    options?: boolean | ModifierGroup$optionsArgs<ExtArgs>
    products?: boolean | ModifierGroup$productsArgs<ExtArgs>
    _count?: boolean | ModifierGroupCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ModifierGroupIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $ModifierGroupPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ModifierGroup"
    objects: {
      options: Prisma.$ModifierOptionPayload<ExtArgs>[]
      products: Prisma.$ProductModifierGroupPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      tenantId: string
      name: string
      minSelections: number
      maxSelections: number
      isRequired: boolean
    }, ExtArgs["result"]["modifierGroup"]>
    composites: {}
  }

  type ModifierGroupGetPayload<S extends boolean | null | undefined | ModifierGroupDefaultArgs> = $Result.GetResult<Prisma.$ModifierGroupPayload, S>

  type ModifierGroupCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ModifierGroupFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ModifierGroupCountAggregateInputType | true
    }

  export interface ModifierGroupDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ModifierGroup'], meta: { name: 'ModifierGroup' } }
    /**
     * Find zero or one ModifierGroup that matches the filter.
     * @param {ModifierGroupFindUniqueArgs} args - Arguments to find a ModifierGroup
     * @example
     * // Get one ModifierGroup
     * const modifierGroup = await prisma.modifierGroup.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ModifierGroupFindUniqueArgs>(args: SelectSubset<T, ModifierGroupFindUniqueArgs<ExtArgs>>): Prisma__ModifierGroupClient<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ModifierGroup that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ModifierGroupFindUniqueOrThrowArgs} args - Arguments to find a ModifierGroup
     * @example
     * // Get one ModifierGroup
     * const modifierGroup = await prisma.modifierGroup.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ModifierGroupFindUniqueOrThrowArgs>(args: SelectSubset<T, ModifierGroupFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ModifierGroupClient<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ModifierGroup that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierGroupFindFirstArgs} args - Arguments to find a ModifierGroup
     * @example
     * // Get one ModifierGroup
     * const modifierGroup = await prisma.modifierGroup.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ModifierGroupFindFirstArgs>(args?: SelectSubset<T, ModifierGroupFindFirstArgs<ExtArgs>>): Prisma__ModifierGroupClient<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ModifierGroup that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierGroupFindFirstOrThrowArgs} args - Arguments to find a ModifierGroup
     * @example
     * // Get one ModifierGroup
     * const modifierGroup = await prisma.modifierGroup.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ModifierGroupFindFirstOrThrowArgs>(args?: SelectSubset<T, ModifierGroupFindFirstOrThrowArgs<ExtArgs>>): Prisma__ModifierGroupClient<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ModifierGroups that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierGroupFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ModifierGroups
     * const modifierGroups = await prisma.modifierGroup.findMany()
     * 
     * // Get first 10 ModifierGroups
     * const modifierGroups = await prisma.modifierGroup.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const modifierGroupWithIdOnly = await prisma.modifierGroup.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ModifierGroupFindManyArgs>(args?: SelectSubset<T, ModifierGroupFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ModifierGroup.
     * @param {ModifierGroupCreateArgs} args - Arguments to create a ModifierGroup.
     * @example
     * // Create one ModifierGroup
     * const ModifierGroup = await prisma.modifierGroup.create({
     *   data: {
     *     // ... data to create a ModifierGroup
     *   }
     * })
     * 
     */
    create<T extends ModifierGroupCreateArgs>(args: SelectSubset<T, ModifierGroupCreateArgs<ExtArgs>>): Prisma__ModifierGroupClient<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ModifierGroups.
     * @param {ModifierGroupCreateManyArgs} args - Arguments to create many ModifierGroups.
     * @example
     * // Create many ModifierGroups
     * const modifierGroup = await prisma.modifierGroup.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ModifierGroupCreateManyArgs>(args?: SelectSubset<T, ModifierGroupCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ModifierGroups and returns the data saved in the database.
     * @param {ModifierGroupCreateManyAndReturnArgs} args - Arguments to create many ModifierGroups.
     * @example
     * // Create many ModifierGroups
     * const modifierGroup = await prisma.modifierGroup.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ModifierGroups and only return the `id`
     * const modifierGroupWithIdOnly = await prisma.modifierGroup.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ModifierGroupCreateManyAndReturnArgs>(args?: SelectSubset<T, ModifierGroupCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a ModifierGroup.
     * @param {ModifierGroupDeleteArgs} args - Arguments to delete one ModifierGroup.
     * @example
     * // Delete one ModifierGroup
     * const ModifierGroup = await prisma.modifierGroup.delete({
     *   where: {
     *     // ... filter to delete one ModifierGroup
     *   }
     * })
     * 
     */
    delete<T extends ModifierGroupDeleteArgs>(args: SelectSubset<T, ModifierGroupDeleteArgs<ExtArgs>>): Prisma__ModifierGroupClient<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ModifierGroup.
     * @param {ModifierGroupUpdateArgs} args - Arguments to update one ModifierGroup.
     * @example
     * // Update one ModifierGroup
     * const modifierGroup = await prisma.modifierGroup.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ModifierGroupUpdateArgs>(args: SelectSubset<T, ModifierGroupUpdateArgs<ExtArgs>>): Prisma__ModifierGroupClient<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ModifierGroups.
     * @param {ModifierGroupDeleteManyArgs} args - Arguments to filter ModifierGroups to delete.
     * @example
     * // Delete a few ModifierGroups
     * const { count } = await prisma.modifierGroup.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ModifierGroupDeleteManyArgs>(args?: SelectSubset<T, ModifierGroupDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ModifierGroups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierGroupUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ModifierGroups
     * const modifierGroup = await prisma.modifierGroup.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ModifierGroupUpdateManyArgs>(args: SelectSubset<T, ModifierGroupUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ModifierGroup.
     * @param {ModifierGroupUpsertArgs} args - Arguments to update or create a ModifierGroup.
     * @example
     * // Update or create a ModifierGroup
     * const modifierGroup = await prisma.modifierGroup.upsert({
     *   create: {
     *     // ... data to create a ModifierGroup
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ModifierGroup we want to update
     *   }
     * })
     */
    upsert<T extends ModifierGroupUpsertArgs>(args: SelectSubset<T, ModifierGroupUpsertArgs<ExtArgs>>): Prisma__ModifierGroupClient<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ModifierGroups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierGroupCountArgs} args - Arguments to filter ModifierGroups to count.
     * @example
     * // Count the number of ModifierGroups
     * const count = await prisma.modifierGroup.count({
     *   where: {
     *     // ... the filter for the ModifierGroups we want to count
     *   }
     * })
    **/
    count<T extends ModifierGroupCountArgs>(
      args?: Subset<T, ModifierGroupCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ModifierGroupCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ModifierGroup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierGroupAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ModifierGroupAggregateArgs>(args: Subset<T, ModifierGroupAggregateArgs>): Prisma.PrismaPromise<GetModifierGroupAggregateType<T>>

    /**
     * Group by ModifierGroup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierGroupGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ModifierGroupGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ModifierGroupGroupByArgs['orderBy'] }
        : { orderBy?: ModifierGroupGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ModifierGroupGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetModifierGroupGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ModifierGroup model
   */
  readonly fields: ModifierGroupFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ModifierGroup.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ModifierGroupClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    options<T extends ModifierGroup$optionsArgs<ExtArgs> = {}>(args?: Subset<T, ModifierGroup$optionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ModifierOptionPayload<ExtArgs>, T, "findMany"> | Null>
    products<T extends ModifierGroup$productsArgs<ExtArgs> = {}>(args?: Subset<T, ModifierGroup$productsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ModifierGroup model
   */ 
  interface ModifierGroupFieldRefs {
    readonly id: FieldRef<"ModifierGroup", 'String'>
    readonly tenantId: FieldRef<"ModifierGroup", 'String'>
    readonly name: FieldRef<"ModifierGroup", 'String'>
    readonly minSelections: FieldRef<"ModifierGroup", 'Int'>
    readonly maxSelections: FieldRef<"ModifierGroup", 'Int'>
    readonly isRequired: FieldRef<"ModifierGroup", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * ModifierGroup findUnique
   */
  export type ModifierGroupFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroup
     */
    select?: ModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierGroupInclude<ExtArgs> | null
    /**
     * Filter, which ModifierGroup to fetch.
     */
    where: ModifierGroupWhereUniqueInput
  }

  /**
   * ModifierGroup findUniqueOrThrow
   */
  export type ModifierGroupFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroup
     */
    select?: ModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierGroupInclude<ExtArgs> | null
    /**
     * Filter, which ModifierGroup to fetch.
     */
    where: ModifierGroupWhereUniqueInput
  }

  /**
   * ModifierGroup findFirst
   */
  export type ModifierGroupFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroup
     */
    select?: ModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierGroupInclude<ExtArgs> | null
    /**
     * Filter, which ModifierGroup to fetch.
     */
    where?: ModifierGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModifierGroups to fetch.
     */
    orderBy?: ModifierGroupOrderByWithRelationInput | ModifierGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ModifierGroups.
     */
    cursor?: ModifierGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModifierGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModifierGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ModifierGroups.
     */
    distinct?: ModifierGroupScalarFieldEnum | ModifierGroupScalarFieldEnum[]
  }

  /**
   * ModifierGroup findFirstOrThrow
   */
  export type ModifierGroupFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroup
     */
    select?: ModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierGroupInclude<ExtArgs> | null
    /**
     * Filter, which ModifierGroup to fetch.
     */
    where?: ModifierGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModifierGroups to fetch.
     */
    orderBy?: ModifierGroupOrderByWithRelationInput | ModifierGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ModifierGroups.
     */
    cursor?: ModifierGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModifierGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModifierGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ModifierGroups.
     */
    distinct?: ModifierGroupScalarFieldEnum | ModifierGroupScalarFieldEnum[]
  }

  /**
   * ModifierGroup findMany
   */
  export type ModifierGroupFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroup
     */
    select?: ModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierGroupInclude<ExtArgs> | null
    /**
     * Filter, which ModifierGroups to fetch.
     */
    where?: ModifierGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModifierGroups to fetch.
     */
    orderBy?: ModifierGroupOrderByWithRelationInput | ModifierGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ModifierGroups.
     */
    cursor?: ModifierGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModifierGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModifierGroups.
     */
    skip?: number
    distinct?: ModifierGroupScalarFieldEnum | ModifierGroupScalarFieldEnum[]
  }

  /**
   * ModifierGroup create
   */
  export type ModifierGroupCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroup
     */
    select?: ModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierGroupInclude<ExtArgs> | null
    /**
     * The data needed to create a ModifierGroup.
     */
    data: XOR<ModifierGroupCreateInput, ModifierGroupUncheckedCreateInput>
  }

  /**
   * ModifierGroup createMany
   */
  export type ModifierGroupCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ModifierGroups.
     */
    data: ModifierGroupCreateManyInput | ModifierGroupCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ModifierGroup createManyAndReturn
   */
  export type ModifierGroupCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroup
     */
    select?: ModifierGroupSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many ModifierGroups.
     */
    data: ModifierGroupCreateManyInput | ModifierGroupCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ModifierGroup update
   */
  export type ModifierGroupUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroup
     */
    select?: ModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierGroupInclude<ExtArgs> | null
    /**
     * The data needed to update a ModifierGroup.
     */
    data: XOR<ModifierGroupUpdateInput, ModifierGroupUncheckedUpdateInput>
    /**
     * Choose, which ModifierGroup to update.
     */
    where: ModifierGroupWhereUniqueInput
  }

  /**
   * ModifierGroup updateMany
   */
  export type ModifierGroupUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ModifierGroups.
     */
    data: XOR<ModifierGroupUpdateManyMutationInput, ModifierGroupUncheckedUpdateManyInput>
    /**
     * Filter which ModifierGroups to update
     */
    where?: ModifierGroupWhereInput
  }

  /**
   * ModifierGroup upsert
   */
  export type ModifierGroupUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroup
     */
    select?: ModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierGroupInclude<ExtArgs> | null
    /**
     * The filter to search for the ModifierGroup to update in case it exists.
     */
    where: ModifierGroupWhereUniqueInput
    /**
     * In case the ModifierGroup found by the `where` argument doesn't exist, create a new ModifierGroup with this data.
     */
    create: XOR<ModifierGroupCreateInput, ModifierGroupUncheckedCreateInput>
    /**
     * In case the ModifierGroup was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ModifierGroupUpdateInput, ModifierGroupUncheckedUpdateInput>
  }

  /**
   * ModifierGroup delete
   */
  export type ModifierGroupDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroup
     */
    select?: ModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierGroupInclude<ExtArgs> | null
    /**
     * Filter which ModifierGroup to delete.
     */
    where: ModifierGroupWhereUniqueInput
  }

  /**
   * ModifierGroup deleteMany
   */
  export type ModifierGroupDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ModifierGroups to delete
     */
    where?: ModifierGroupWhereInput
  }

  /**
   * ModifierGroup.options
   */
  export type ModifierGroup$optionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionInclude<ExtArgs> | null
    where?: ModifierOptionWhereInput
    orderBy?: ModifierOptionOrderByWithRelationInput | ModifierOptionOrderByWithRelationInput[]
    cursor?: ModifierOptionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ModifierOptionScalarFieldEnum | ModifierOptionScalarFieldEnum[]
  }

  /**
   * ModifierGroup.products
   */
  export type ModifierGroup$productsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
    where?: ProductModifierGroupWhereInput
    orderBy?: ProductModifierGroupOrderByWithRelationInput | ProductModifierGroupOrderByWithRelationInput[]
    cursor?: ProductModifierGroupWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ProductModifierGroupScalarFieldEnum | ProductModifierGroupScalarFieldEnum[]
  }

  /**
   * ModifierGroup without action
   */
  export type ModifierGroupDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierGroup
     */
    select?: ModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierGroupInclude<ExtArgs> | null
  }


  /**
   * Model ModifierOption
   */

  export type AggregateModifierOption = {
    _count: ModifierOptionCountAggregateOutputType | null
    _avg: ModifierOptionAvgAggregateOutputType | null
    _sum: ModifierOptionSumAggregateOutputType | null
    _min: ModifierOptionMinAggregateOutputType | null
    _max: ModifierOptionMaxAggregateOutputType | null
  }

  export type ModifierOptionAvgAggregateOutputType = {
    priceDelta: Decimal | null
  }

  export type ModifierOptionSumAggregateOutputType = {
    priceDelta: Decimal | null
  }

  export type ModifierOptionMinAggregateOutputType = {
    id: string | null
    groupId: string | null
    name: string | null
    priceDelta: Decimal | null
    isDefault: boolean | null
  }

  export type ModifierOptionMaxAggregateOutputType = {
    id: string | null
    groupId: string | null
    name: string | null
    priceDelta: Decimal | null
    isDefault: boolean | null
  }

  export type ModifierOptionCountAggregateOutputType = {
    id: number
    groupId: number
    name: number
    priceDelta: number
    isDefault: number
    _all: number
  }


  export type ModifierOptionAvgAggregateInputType = {
    priceDelta?: true
  }

  export type ModifierOptionSumAggregateInputType = {
    priceDelta?: true
  }

  export type ModifierOptionMinAggregateInputType = {
    id?: true
    groupId?: true
    name?: true
    priceDelta?: true
    isDefault?: true
  }

  export type ModifierOptionMaxAggregateInputType = {
    id?: true
    groupId?: true
    name?: true
    priceDelta?: true
    isDefault?: true
  }

  export type ModifierOptionCountAggregateInputType = {
    id?: true
    groupId?: true
    name?: true
    priceDelta?: true
    isDefault?: true
    _all?: true
  }

  export type ModifierOptionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ModifierOption to aggregate.
     */
    where?: ModifierOptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModifierOptions to fetch.
     */
    orderBy?: ModifierOptionOrderByWithRelationInput | ModifierOptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ModifierOptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModifierOptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModifierOptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ModifierOptions
    **/
    _count?: true | ModifierOptionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ModifierOptionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ModifierOptionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ModifierOptionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ModifierOptionMaxAggregateInputType
  }

  export type GetModifierOptionAggregateType<T extends ModifierOptionAggregateArgs> = {
        [P in keyof T & keyof AggregateModifierOption]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateModifierOption[P]>
      : GetScalarType<T[P], AggregateModifierOption[P]>
  }




  export type ModifierOptionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ModifierOptionWhereInput
    orderBy?: ModifierOptionOrderByWithAggregationInput | ModifierOptionOrderByWithAggregationInput[]
    by: ModifierOptionScalarFieldEnum[] | ModifierOptionScalarFieldEnum
    having?: ModifierOptionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ModifierOptionCountAggregateInputType | true
    _avg?: ModifierOptionAvgAggregateInputType
    _sum?: ModifierOptionSumAggregateInputType
    _min?: ModifierOptionMinAggregateInputType
    _max?: ModifierOptionMaxAggregateInputType
  }

  export type ModifierOptionGroupByOutputType = {
    id: string
    groupId: string
    name: string
    priceDelta: Decimal
    isDefault: boolean
    _count: ModifierOptionCountAggregateOutputType | null
    _avg: ModifierOptionAvgAggregateOutputType | null
    _sum: ModifierOptionSumAggregateOutputType | null
    _min: ModifierOptionMinAggregateOutputType | null
    _max: ModifierOptionMaxAggregateOutputType | null
  }

  type GetModifierOptionGroupByPayload<T extends ModifierOptionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ModifierOptionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ModifierOptionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ModifierOptionGroupByOutputType[P]>
            : GetScalarType<T[P], ModifierOptionGroupByOutputType[P]>
        }
      >
    >


  export type ModifierOptionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    groupId?: boolean
    name?: boolean
    priceDelta?: boolean
    isDefault?: boolean
    group?: boolean | ModifierGroupDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["modifierOption"]>

  export type ModifierOptionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    groupId?: boolean
    name?: boolean
    priceDelta?: boolean
    isDefault?: boolean
    group?: boolean | ModifierGroupDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["modifierOption"]>

  export type ModifierOptionSelectScalar = {
    id?: boolean
    groupId?: boolean
    name?: boolean
    priceDelta?: boolean
    isDefault?: boolean
  }

  export type ModifierOptionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    group?: boolean | ModifierGroupDefaultArgs<ExtArgs>
  }
  export type ModifierOptionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    group?: boolean | ModifierGroupDefaultArgs<ExtArgs>
  }

  export type $ModifierOptionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ModifierOption"
    objects: {
      group: Prisma.$ModifierGroupPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      groupId: string
      name: string
      priceDelta: Prisma.Decimal
      isDefault: boolean
    }, ExtArgs["result"]["modifierOption"]>
    composites: {}
  }

  type ModifierOptionGetPayload<S extends boolean | null | undefined | ModifierOptionDefaultArgs> = $Result.GetResult<Prisma.$ModifierOptionPayload, S>

  type ModifierOptionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ModifierOptionFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ModifierOptionCountAggregateInputType | true
    }

  export interface ModifierOptionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ModifierOption'], meta: { name: 'ModifierOption' } }
    /**
     * Find zero or one ModifierOption that matches the filter.
     * @param {ModifierOptionFindUniqueArgs} args - Arguments to find a ModifierOption
     * @example
     * // Get one ModifierOption
     * const modifierOption = await prisma.modifierOption.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ModifierOptionFindUniqueArgs>(args: SelectSubset<T, ModifierOptionFindUniqueArgs<ExtArgs>>): Prisma__ModifierOptionClient<$Result.GetResult<Prisma.$ModifierOptionPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ModifierOption that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ModifierOptionFindUniqueOrThrowArgs} args - Arguments to find a ModifierOption
     * @example
     * // Get one ModifierOption
     * const modifierOption = await prisma.modifierOption.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ModifierOptionFindUniqueOrThrowArgs>(args: SelectSubset<T, ModifierOptionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ModifierOptionClient<$Result.GetResult<Prisma.$ModifierOptionPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ModifierOption that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierOptionFindFirstArgs} args - Arguments to find a ModifierOption
     * @example
     * // Get one ModifierOption
     * const modifierOption = await prisma.modifierOption.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ModifierOptionFindFirstArgs>(args?: SelectSubset<T, ModifierOptionFindFirstArgs<ExtArgs>>): Prisma__ModifierOptionClient<$Result.GetResult<Prisma.$ModifierOptionPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ModifierOption that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierOptionFindFirstOrThrowArgs} args - Arguments to find a ModifierOption
     * @example
     * // Get one ModifierOption
     * const modifierOption = await prisma.modifierOption.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ModifierOptionFindFirstOrThrowArgs>(args?: SelectSubset<T, ModifierOptionFindFirstOrThrowArgs<ExtArgs>>): Prisma__ModifierOptionClient<$Result.GetResult<Prisma.$ModifierOptionPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ModifierOptions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierOptionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ModifierOptions
     * const modifierOptions = await prisma.modifierOption.findMany()
     * 
     * // Get first 10 ModifierOptions
     * const modifierOptions = await prisma.modifierOption.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const modifierOptionWithIdOnly = await prisma.modifierOption.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ModifierOptionFindManyArgs>(args?: SelectSubset<T, ModifierOptionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ModifierOptionPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ModifierOption.
     * @param {ModifierOptionCreateArgs} args - Arguments to create a ModifierOption.
     * @example
     * // Create one ModifierOption
     * const ModifierOption = await prisma.modifierOption.create({
     *   data: {
     *     // ... data to create a ModifierOption
     *   }
     * })
     * 
     */
    create<T extends ModifierOptionCreateArgs>(args: SelectSubset<T, ModifierOptionCreateArgs<ExtArgs>>): Prisma__ModifierOptionClient<$Result.GetResult<Prisma.$ModifierOptionPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ModifierOptions.
     * @param {ModifierOptionCreateManyArgs} args - Arguments to create many ModifierOptions.
     * @example
     * // Create many ModifierOptions
     * const modifierOption = await prisma.modifierOption.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ModifierOptionCreateManyArgs>(args?: SelectSubset<T, ModifierOptionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ModifierOptions and returns the data saved in the database.
     * @param {ModifierOptionCreateManyAndReturnArgs} args - Arguments to create many ModifierOptions.
     * @example
     * // Create many ModifierOptions
     * const modifierOption = await prisma.modifierOption.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ModifierOptions and only return the `id`
     * const modifierOptionWithIdOnly = await prisma.modifierOption.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ModifierOptionCreateManyAndReturnArgs>(args?: SelectSubset<T, ModifierOptionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ModifierOptionPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a ModifierOption.
     * @param {ModifierOptionDeleteArgs} args - Arguments to delete one ModifierOption.
     * @example
     * // Delete one ModifierOption
     * const ModifierOption = await prisma.modifierOption.delete({
     *   where: {
     *     // ... filter to delete one ModifierOption
     *   }
     * })
     * 
     */
    delete<T extends ModifierOptionDeleteArgs>(args: SelectSubset<T, ModifierOptionDeleteArgs<ExtArgs>>): Prisma__ModifierOptionClient<$Result.GetResult<Prisma.$ModifierOptionPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ModifierOption.
     * @param {ModifierOptionUpdateArgs} args - Arguments to update one ModifierOption.
     * @example
     * // Update one ModifierOption
     * const modifierOption = await prisma.modifierOption.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ModifierOptionUpdateArgs>(args: SelectSubset<T, ModifierOptionUpdateArgs<ExtArgs>>): Prisma__ModifierOptionClient<$Result.GetResult<Prisma.$ModifierOptionPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ModifierOptions.
     * @param {ModifierOptionDeleteManyArgs} args - Arguments to filter ModifierOptions to delete.
     * @example
     * // Delete a few ModifierOptions
     * const { count } = await prisma.modifierOption.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ModifierOptionDeleteManyArgs>(args?: SelectSubset<T, ModifierOptionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ModifierOptions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierOptionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ModifierOptions
     * const modifierOption = await prisma.modifierOption.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ModifierOptionUpdateManyArgs>(args: SelectSubset<T, ModifierOptionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ModifierOption.
     * @param {ModifierOptionUpsertArgs} args - Arguments to update or create a ModifierOption.
     * @example
     * // Update or create a ModifierOption
     * const modifierOption = await prisma.modifierOption.upsert({
     *   create: {
     *     // ... data to create a ModifierOption
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ModifierOption we want to update
     *   }
     * })
     */
    upsert<T extends ModifierOptionUpsertArgs>(args: SelectSubset<T, ModifierOptionUpsertArgs<ExtArgs>>): Prisma__ModifierOptionClient<$Result.GetResult<Prisma.$ModifierOptionPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ModifierOptions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierOptionCountArgs} args - Arguments to filter ModifierOptions to count.
     * @example
     * // Count the number of ModifierOptions
     * const count = await prisma.modifierOption.count({
     *   where: {
     *     // ... the filter for the ModifierOptions we want to count
     *   }
     * })
    **/
    count<T extends ModifierOptionCountArgs>(
      args?: Subset<T, ModifierOptionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ModifierOptionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ModifierOption.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierOptionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ModifierOptionAggregateArgs>(args: Subset<T, ModifierOptionAggregateArgs>): Prisma.PrismaPromise<GetModifierOptionAggregateType<T>>

    /**
     * Group by ModifierOption.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModifierOptionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ModifierOptionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ModifierOptionGroupByArgs['orderBy'] }
        : { orderBy?: ModifierOptionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ModifierOptionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetModifierOptionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ModifierOption model
   */
  readonly fields: ModifierOptionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ModifierOption.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ModifierOptionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    group<T extends ModifierGroupDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ModifierGroupDefaultArgs<ExtArgs>>): Prisma__ModifierGroupClient<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ModifierOption model
   */ 
  interface ModifierOptionFieldRefs {
    readonly id: FieldRef<"ModifierOption", 'String'>
    readonly groupId: FieldRef<"ModifierOption", 'String'>
    readonly name: FieldRef<"ModifierOption", 'String'>
    readonly priceDelta: FieldRef<"ModifierOption", 'Decimal'>
    readonly isDefault: FieldRef<"ModifierOption", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * ModifierOption findUnique
   */
  export type ModifierOptionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionInclude<ExtArgs> | null
    /**
     * Filter, which ModifierOption to fetch.
     */
    where: ModifierOptionWhereUniqueInput
  }

  /**
   * ModifierOption findUniqueOrThrow
   */
  export type ModifierOptionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionInclude<ExtArgs> | null
    /**
     * Filter, which ModifierOption to fetch.
     */
    where: ModifierOptionWhereUniqueInput
  }

  /**
   * ModifierOption findFirst
   */
  export type ModifierOptionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionInclude<ExtArgs> | null
    /**
     * Filter, which ModifierOption to fetch.
     */
    where?: ModifierOptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModifierOptions to fetch.
     */
    orderBy?: ModifierOptionOrderByWithRelationInput | ModifierOptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ModifierOptions.
     */
    cursor?: ModifierOptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModifierOptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModifierOptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ModifierOptions.
     */
    distinct?: ModifierOptionScalarFieldEnum | ModifierOptionScalarFieldEnum[]
  }

  /**
   * ModifierOption findFirstOrThrow
   */
  export type ModifierOptionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionInclude<ExtArgs> | null
    /**
     * Filter, which ModifierOption to fetch.
     */
    where?: ModifierOptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModifierOptions to fetch.
     */
    orderBy?: ModifierOptionOrderByWithRelationInput | ModifierOptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ModifierOptions.
     */
    cursor?: ModifierOptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModifierOptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModifierOptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ModifierOptions.
     */
    distinct?: ModifierOptionScalarFieldEnum | ModifierOptionScalarFieldEnum[]
  }

  /**
   * ModifierOption findMany
   */
  export type ModifierOptionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionInclude<ExtArgs> | null
    /**
     * Filter, which ModifierOptions to fetch.
     */
    where?: ModifierOptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModifierOptions to fetch.
     */
    orderBy?: ModifierOptionOrderByWithRelationInput | ModifierOptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ModifierOptions.
     */
    cursor?: ModifierOptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModifierOptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModifierOptions.
     */
    skip?: number
    distinct?: ModifierOptionScalarFieldEnum | ModifierOptionScalarFieldEnum[]
  }

  /**
   * ModifierOption create
   */
  export type ModifierOptionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionInclude<ExtArgs> | null
    /**
     * The data needed to create a ModifierOption.
     */
    data: XOR<ModifierOptionCreateInput, ModifierOptionUncheckedCreateInput>
  }

  /**
   * ModifierOption createMany
   */
  export type ModifierOptionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ModifierOptions.
     */
    data: ModifierOptionCreateManyInput | ModifierOptionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ModifierOption createManyAndReturn
   */
  export type ModifierOptionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many ModifierOptions.
     */
    data: ModifierOptionCreateManyInput | ModifierOptionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ModifierOption update
   */
  export type ModifierOptionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionInclude<ExtArgs> | null
    /**
     * The data needed to update a ModifierOption.
     */
    data: XOR<ModifierOptionUpdateInput, ModifierOptionUncheckedUpdateInput>
    /**
     * Choose, which ModifierOption to update.
     */
    where: ModifierOptionWhereUniqueInput
  }

  /**
   * ModifierOption updateMany
   */
  export type ModifierOptionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ModifierOptions.
     */
    data: XOR<ModifierOptionUpdateManyMutationInput, ModifierOptionUncheckedUpdateManyInput>
    /**
     * Filter which ModifierOptions to update
     */
    where?: ModifierOptionWhereInput
  }

  /**
   * ModifierOption upsert
   */
  export type ModifierOptionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionInclude<ExtArgs> | null
    /**
     * The filter to search for the ModifierOption to update in case it exists.
     */
    where: ModifierOptionWhereUniqueInput
    /**
     * In case the ModifierOption found by the `where` argument doesn't exist, create a new ModifierOption with this data.
     */
    create: XOR<ModifierOptionCreateInput, ModifierOptionUncheckedCreateInput>
    /**
     * In case the ModifierOption was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ModifierOptionUpdateInput, ModifierOptionUncheckedUpdateInput>
  }

  /**
   * ModifierOption delete
   */
  export type ModifierOptionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionInclude<ExtArgs> | null
    /**
     * Filter which ModifierOption to delete.
     */
    where: ModifierOptionWhereUniqueInput
  }

  /**
   * ModifierOption deleteMany
   */
  export type ModifierOptionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ModifierOptions to delete
     */
    where?: ModifierOptionWhereInput
  }

  /**
   * ModifierOption without action
   */
  export type ModifierOptionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModifierOption
     */
    select?: ModifierOptionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ModifierOptionInclude<ExtArgs> | null
  }


  /**
   * Model ProductModifierGroup
   */

  export type AggregateProductModifierGroup = {
    _count: ProductModifierGroupCountAggregateOutputType | null
    _min: ProductModifierGroupMinAggregateOutputType | null
    _max: ProductModifierGroupMaxAggregateOutputType | null
  }

  export type ProductModifierGroupMinAggregateOutputType = {
    productId: string | null
    groupId: string | null
  }

  export type ProductModifierGroupMaxAggregateOutputType = {
    productId: string | null
    groupId: string | null
  }

  export type ProductModifierGroupCountAggregateOutputType = {
    productId: number
    groupId: number
    _all: number
  }


  export type ProductModifierGroupMinAggregateInputType = {
    productId?: true
    groupId?: true
  }

  export type ProductModifierGroupMaxAggregateInputType = {
    productId?: true
    groupId?: true
  }

  export type ProductModifierGroupCountAggregateInputType = {
    productId?: true
    groupId?: true
    _all?: true
  }

  export type ProductModifierGroupAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ProductModifierGroup to aggregate.
     */
    where?: ProductModifierGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProductModifierGroups to fetch.
     */
    orderBy?: ProductModifierGroupOrderByWithRelationInput | ProductModifierGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ProductModifierGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProductModifierGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProductModifierGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ProductModifierGroups
    **/
    _count?: true | ProductModifierGroupCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ProductModifierGroupMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ProductModifierGroupMaxAggregateInputType
  }

  export type GetProductModifierGroupAggregateType<T extends ProductModifierGroupAggregateArgs> = {
        [P in keyof T & keyof AggregateProductModifierGroup]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateProductModifierGroup[P]>
      : GetScalarType<T[P], AggregateProductModifierGroup[P]>
  }




  export type ProductModifierGroupGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ProductModifierGroupWhereInput
    orderBy?: ProductModifierGroupOrderByWithAggregationInput | ProductModifierGroupOrderByWithAggregationInput[]
    by: ProductModifierGroupScalarFieldEnum[] | ProductModifierGroupScalarFieldEnum
    having?: ProductModifierGroupScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ProductModifierGroupCountAggregateInputType | true
    _min?: ProductModifierGroupMinAggregateInputType
    _max?: ProductModifierGroupMaxAggregateInputType
  }

  export type ProductModifierGroupGroupByOutputType = {
    productId: string
    groupId: string
    _count: ProductModifierGroupCountAggregateOutputType | null
    _min: ProductModifierGroupMinAggregateOutputType | null
    _max: ProductModifierGroupMaxAggregateOutputType | null
  }

  type GetProductModifierGroupGroupByPayload<T extends ProductModifierGroupGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ProductModifierGroupGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ProductModifierGroupGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ProductModifierGroupGroupByOutputType[P]>
            : GetScalarType<T[P], ProductModifierGroupGroupByOutputType[P]>
        }
      >
    >


  export type ProductModifierGroupSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    productId?: boolean
    groupId?: boolean
    product?: boolean | ProductDefaultArgs<ExtArgs>
    group?: boolean | ModifierGroupDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["productModifierGroup"]>

  export type ProductModifierGroupSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    productId?: boolean
    groupId?: boolean
    product?: boolean | ProductDefaultArgs<ExtArgs>
    group?: boolean | ModifierGroupDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["productModifierGroup"]>

  export type ProductModifierGroupSelectScalar = {
    productId?: boolean
    groupId?: boolean
  }

  export type ProductModifierGroupInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    product?: boolean | ProductDefaultArgs<ExtArgs>
    group?: boolean | ModifierGroupDefaultArgs<ExtArgs>
  }
  export type ProductModifierGroupIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    product?: boolean | ProductDefaultArgs<ExtArgs>
    group?: boolean | ModifierGroupDefaultArgs<ExtArgs>
  }

  export type $ProductModifierGroupPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ProductModifierGroup"
    objects: {
      product: Prisma.$ProductPayload<ExtArgs>
      group: Prisma.$ModifierGroupPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      productId: string
      groupId: string
    }, ExtArgs["result"]["productModifierGroup"]>
    composites: {}
  }

  type ProductModifierGroupGetPayload<S extends boolean | null | undefined | ProductModifierGroupDefaultArgs> = $Result.GetResult<Prisma.$ProductModifierGroupPayload, S>

  type ProductModifierGroupCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ProductModifierGroupFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ProductModifierGroupCountAggregateInputType | true
    }

  export interface ProductModifierGroupDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ProductModifierGroup'], meta: { name: 'ProductModifierGroup' } }
    /**
     * Find zero or one ProductModifierGroup that matches the filter.
     * @param {ProductModifierGroupFindUniqueArgs} args - Arguments to find a ProductModifierGroup
     * @example
     * // Get one ProductModifierGroup
     * const productModifierGroup = await prisma.productModifierGroup.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ProductModifierGroupFindUniqueArgs>(args: SelectSubset<T, ProductModifierGroupFindUniqueArgs<ExtArgs>>): Prisma__ProductModifierGroupClient<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ProductModifierGroup that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ProductModifierGroupFindUniqueOrThrowArgs} args - Arguments to find a ProductModifierGroup
     * @example
     * // Get one ProductModifierGroup
     * const productModifierGroup = await prisma.productModifierGroup.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ProductModifierGroupFindUniqueOrThrowArgs>(args: SelectSubset<T, ProductModifierGroupFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ProductModifierGroupClient<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ProductModifierGroup that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductModifierGroupFindFirstArgs} args - Arguments to find a ProductModifierGroup
     * @example
     * // Get one ProductModifierGroup
     * const productModifierGroup = await prisma.productModifierGroup.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ProductModifierGroupFindFirstArgs>(args?: SelectSubset<T, ProductModifierGroupFindFirstArgs<ExtArgs>>): Prisma__ProductModifierGroupClient<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ProductModifierGroup that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductModifierGroupFindFirstOrThrowArgs} args - Arguments to find a ProductModifierGroup
     * @example
     * // Get one ProductModifierGroup
     * const productModifierGroup = await prisma.productModifierGroup.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ProductModifierGroupFindFirstOrThrowArgs>(args?: SelectSubset<T, ProductModifierGroupFindFirstOrThrowArgs<ExtArgs>>): Prisma__ProductModifierGroupClient<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ProductModifierGroups that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductModifierGroupFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ProductModifierGroups
     * const productModifierGroups = await prisma.productModifierGroup.findMany()
     * 
     * // Get first 10 ProductModifierGroups
     * const productModifierGroups = await prisma.productModifierGroup.findMany({ take: 10 })
     * 
     * // Only select the `productId`
     * const productModifierGroupWithProductIdOnly = await prisma.productModifierGroup.findMany({ select: { productId: true } })
     * 
     */
    findMany<T extends ProductModifierGroupFindManyArgs>(args?: SelectSubset<T, ProductModifierGroupFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ProductModifierGroup.
     * @param {ProductModifierGroupCreateArgs} args - Arguments to create a ProductModifierGroup.
     * @example
     * // Create one ProductModifierGroup
     * const ProductModifierGroup = await prisma.productModifierGroup.create({
     *   data: {
     *     // ... data to create a ProductModifierGroup
     *   }
     * })
     * 
     */
    create<T extends ProductModifierGroupCreateArgs>(args: SelectSubset<T, ProductModifierGroupCreateArgs<ExtArgs>>): Prisma__ProductModifierGroupClient<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ProductModifierGroups.
     * @param {ProductModifierGroupCreateManyArgs} args - Arguments to create many ProductModifierGroups.
     * @example
     * // Create many ProductModifierGroups
     * const productModifierGroup = await prisma.productModifierGroup.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ProductModifierGroupCreateManyArgs>(args?: SelectSubset<T, ProductModifierGroupCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ProductModifierGroups and returns the data saved in the database.
     * @param {ProductModifierGroupCreateManyAndReturnArgs} args - Arguments to create many ProductModifierGroups.
     * @example
     * // Create many ProductModifierGroups
     * const productModifierGroup = await prisma.productModifierGroup.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ProductModifierGroups and only return the `productId`
     * const productModifierGroupWithProductIdOnly = await prisma.productModifierGroup.createManyAndReturn({ 
     *   select: { productId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ProductModifierGroupCreateManyAndReturnArgs>(args?: SelectSubset<T, ProductModifierGroupCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a ProductModifierGroup.
     * @param {ProductModifierGroupDeleteArgs} args - Arguments to delete one ProductModifierGroup.
     * @example
     * // Delete one ProductModifierGroup
     * const ProductModifierGroup = await prisma.productModifierGroup.delete({
     *   where: {
     *     // ... filter to delete one ProductModifierGroup
     *   }
     * })
     * 
     */
    delete<T extends ProductModifierGroupDeleteArgs>(args: SelectSubset<T, ProductModifierGroupDeleteArgs<ExtArgs>>): Prisma__ProductModifierGroupClient<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ProductModifierGroup.
     * @param {ProductModifierGroupUpdateArgs} args - Arguments to update one ProductModifierGroup.
     * @example
     * // Update one ProductModifierGroup
     * const productModifierGroup = await prisma.productModifierGroup.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ProductModifierGroupUpdateArgs>(args: SelectSubset<T, ProductModifierGroupUpdateArgs<ExtArgs>>): Prisma__ProductModifierGroupClient<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ProductModifierGroups.
     * @param {ProductModifierGroupDeleteManyArgs} args - Arguments to filter ProductModifierGroups to delete.
     * @example
     * // Delete a few ProductModifierGroups
     * const { count } = await prisma.productModifierGroup.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ProductModifierGroupDeleteManyArgs>(args?: SelectSubset<T, ProductModifierGroupDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ProductModifierGroups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductModifierGroupUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ProductModifierGroups
     * const productModifierGroup = await prisma.productModifierGroup.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ProductModifierGroupUpdateManyArgs>(args: SelectSubset<T, ProductModifierGroupUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ProductModifierGroup.
     * @param {ProductModifierGroupUpsertArgs} args - Arguments to update or create a ProductModifierGroup.
     * @example
     * // Update or create a ProductModifierGroup
     * const productModifierGroup = await prisma.productModifierGroup.upsert({
     *   create: {
     *     // ... data to create a ProductModifierGroup
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ProductModifierGroup we want to update
     *   }
     * })
     */
    upsert<T extends ProductModifierGroupUpsertArgs>(args: SelectSubset<T, ProductModifierGroupUpsertArgs<ExtArgs>>): Prisma__ProductModifierGroupClient<$Result.GetResult<Prisma.$ProductModifierGroupPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ProductModifierGroups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductModifierGroupCountArgs} args - Arguments to filter ProductModifierGroups to count.
     * @example
     * // Count the number of ProductModifierGroups
     * const count = await prisma.productModifierGroup.count({
     *   where: {
     *     // ... the filter for the ProductModifierGroups we want to count
     *   }
     * })
    **/
    count<T extends ProductModifierGroupCountArgs>(
      args?: Subset<T, ProductModifierGroupCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ProductModifierGroupCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ProductModifierGroup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductModifierGroupAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ProductModifierGroupAggregateArgs>(args: Subset<T, ProductModifierGroupAggregateArgs>): Prisma.PrismaPromise<GetProductModifierGroupAggregateType<T>>

    /**
     * Group by ProductModifierGroup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductModifierGroupGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ProductModifierGroupGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ProductModifierGroupGroupByArgs['orderBy'] }
        : { orderBy?: ProductModifierGroupGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ProductModifierGroupGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetProductModifierGroupGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ProductModifierGroup model
   */
  readonly fields: ProductModifierGroupFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ProductModifierGroup.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ProductModifierGroupClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    product<T extends ProductDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ProductDefaultArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    group<T extends ModifierGroupDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ModifierGroupDefaultArgs<ExtArgs>>): Prisma__ModifierGroupClient<$Result.GetResult<Prisma.$ModifierGroupPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ProductModifierGroup model
   */ 
  interface ProductModifierGroupFieldRefs {
    readonly productId: FieldRef<"ProductModifierGroup", 'String'>
    readonly groupId: FieldRef<"ProductModifierGroup", 'String'>
  }
    

  // Custom InputTypes
  /**
   * ProductModifierGroup findUnique
   */
  export type ProductModifierGroupFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
    /**
     * Filter, which ProductModifierGroup to fetch.
     */
    where: ProductModifierGroupWhereUniqueInput
  }

  /**
   * ProductModifierGroup findUniqueOrThrow
   */
  export type ProductModifierGroupFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
    /**
     * Filter, which ProductModifierGroup to fetch.
     */
    where: ProductModifierGroupWhereUniqueInput
  }

  /**
   * ProductModifierGroup findFirst
   */
  export type ProductModifierGroupFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
    /**
     * Filter, which ProductModifierGroup to fetch.
     */
    where?: ProductModifierGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProductModifierGroups to fetch.
     */
    orderBy?: ProductModifierGroupOrderByWithRelationInput | ProductModifierGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ProductModifierGroups.
     */
    cursor?: ProductModifierGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProductModifierGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProductModifierGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ProductModifierGroups.
     */
    distinct?: ProductModifierGroupScalarFieldEnum | ProductModifierGroupScalarFieldEnum[]
  }

  /**
   * ProductModifierGroup findFirstOrThrow
   */
  export type ProductModifierGroupFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
    /**
     * Filter, which ProductModifierGroup to fetch.
     */
    where?: ProductModifierGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProductModifierGroups to fetch.
     */
    orderBy?: ProductModifierGroupOrderByWithRelationInput | ProductModifierGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ProductModifierGroups.
     */
    cursor?: ProductModifierGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProductModifierGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProductModifierGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ProductModifierGroups.
     */
    distinct?: ProductModifierGroupScalarFieldEnum | ProductModifierGroupScalarFieldEnum[]
  }

  /**
   * ProductModifierGroup findMany
   */
  export type ProductModifierGroupFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
    /**
     * Filter, which ProductModifierGroups to fetch.
     */
    where?: ProductModifierGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProductModifierGroups to fetch.
     */
    orderBy?: ProductModifierGroupOrderByWithRelationInput | ProductModifierGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ProductModifierGroups.
     */
    cursor?: ProductModifierGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProductModifierGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProductModifierGroups.
     */
    skip?: number
    distinct?: ProductModifierGroupScalarFieldEnum | ProductModifierGroupScalarFieldEnum[]
  }

  /**
   * ProductModifierGroup create
   */
  export type ProductModifierGroupCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
    /**
     * The data needed to create a ProductModifierGroup.
     */
    data: XOR<ProductModifierGroupCreateInput, ProductModifierGroupUncheckedCreateInput>
  }

  /**
   * ProductModifierGroup createMany
   */
  export type ProductModifierGroupCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ProductModifierGroups.
     */
    data: ProductModifierGroupCreateManyInput | ProductModifierGroupCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ProductModifierGroup createManyAndReturn
   */
  export type ProductModifierGroupCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many ProductModifierGroups.
     */
    data: ProductModifierGroupCreateManyInput | ProductModifierGroupCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ProductModifierGroup update
   */
  export type ProductModifierGroupUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
    /**
     * The data needed to update a ProductModifierGroup.
     */
    data: XOR<ProductModifierGroupUpdateInput, ProductModifierGroupUncheckedUpdateInput>
    /**
     * Choose, which ProductModifierGroup to update.
     */
    where: ProductModifierGroupWhereUniqueInput
  }

  /**
   * ProductModifierGroup updateMany
   */
  export type ProductModifierGroupUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ProductModifierGroups.
     */
    data: XOR<ProductModifierGroupUpdateManyMutationInput, ProductModifierGroupUncheckedUpdateManyInput>
    /**
     * Filter which ProductModifierGroups to update
     */
    where?: ProductModifierGroupWhereInput
  }

  /**
   * ProductModifierGroup upsert
   */
  export type ProductModifierGroupUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
    /**
     * The filter to search for the ProductModifierGroup to update in case it exists.
     */
    where: ProductModifierGroupWhereUniqueInput
    /**
     * In case the ProductModifierGroup found by the `where` argument doesn't exist, create a new ProductModifierGroup with this data.
     */
    create: XOR<ProductModifierGroupCreateInput, ProductModifierGroupUncheckedCreateInput>
    /**
     * In case the ProductModifierGroup was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ProductModifierGroupUpdateInput, ProductModifierGroupUncheckedUpdateInput>
  }

  /**
   * ProductModifierGroup delete
   */
  export type ProductModifierGroupDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
    /**
     * Filter which ProductModifierGroup to delete.
     */
    where: ProductModifierGroupWhereUniqueInput
  }

  /**
   * ProductModifierGroup deleteMany
   */
  export type ProductModifierGroupDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ProductModifierGroups to delete
     */
    where?: ProductModifierGroupWhereInput
  }

  /**
   * ProductModifierGroup without action
   */
  export type ProductModifierGroupDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductModifierGroup
     */
    select?: ProductModifierGroupSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProductModifierGroupInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const CategoryScalarFieldEnum: {
    id: 'id',
    tenantId: 'tenantId',
    name: 'name',
    sortOrder: 'sortOrder',
    isActive: 'isActive',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CategoryScalarFieldEnum = (typeof CategoryScalarFieldEnum)[keyof typeof CategoryScalarFieldEnum]


  export const ProductScalarFieldEnum: {
    id: 'id',
    tenantId: 'tenantId',
    categoryId: 'categoryId',
    name: 'name',
    description: 'description',
    price: 'price',
    imageUrl: 'imageUrl',
    isAvailable: 'isAvailable',
    sortOrder: 'sortOrder',
    prepTimeMinutes: 'prepTimeMinutes',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ProductScalarFieldEnum = (typeof ProductScalarFieldEnum)[keyof typeof ProductScalarFieldEnum]


  export const ModifierGroupScalarFieldEnum: {
    id: 'id',
    tenantId: 'tenantId',
    name: 'name',
    minSelections: 'minSelections',
    maxSelections: 'maxSelections',
    isRequired: 'isRequired'
  };

  export type ModifierGroupScalarFieldEnum = (typeof ModifierGroupScalarFieldEnum)[keyof typeof ModifierGroupScalarFieldEnum]


  export const ModifierOptionScalarFieldEnum: {
    id: 'id',
    groupId: 'groupId',
    name: 'name',
    priceDelta: 'priceDelta',
    isDefault: 'isDefault'
  };

  export type ModifierOptionScalarFieldEnum = (typeof ModifierOptionScalarFieldEnum)[keyof typeof ModifierOptionScalarFieldEnum]


  export const ProductModifierGroupScalarFieldEnum: {
    productId: 'productId',
    groupId: 'groupId'
  };

  export type ProductModifierGroupScalarFieldEnum = (typeof ProductModifierGroupScalarFieldEnum)[keyof typeof ProductModifierGroupScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type CategoryWhereInput = {
    AND?: CategoryWhereInput | CategoryWhereInput[]
    OR?: CategoryWhereInput[]
    NOT?: CategoryWhereInput | CategoryWhereInput[]
    id?: StringFilter<"Category"> | string
    tenantId?: StringFilter<"Category"> | string
    name?: StringFilter<"Category"> | string
    sortOrder?: IntFilter<"Category"> | number
    isActive?: BoolFilter<"Category"> | boolean
    createdAt?: DateTimeFilter<"Category"> | Date | string
    updatedAt?: DateTimeFilter<"Category"> | Date | string
    products?: ProductListRelationFilter
  }

  export type CategoryOrderByWithRelationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    name?: SortOrder
    sortOrder?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    products?: ProductOrderByRelationAggregateInput
  }

  export type CategoryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    tenantId_name?: CategoryTenantIdNameCompoundUniqueInput
    AND?: CategoryWhereInput | CategoryWhereInput[]
    OR?: CategoryWhereInput[]
    NOT?: CategoryWhereInput | CategoryWhereInput[]
    tenantId?: StringFilter<"Category"> | string
    name?: StringFilter<"Category"> | string
    sortOrder?: IntFilter<"Category"> | number
    isActive?: BoolFilter<"Category"> | boolean
    createdAt?: DateTimeFilter<"Category"> | Date | string
    updatedAt?: DateTimeFilter<"Category"> | Date | string
    products?: ProductListRelationFilter
  }, "id" | "tenantId_name">

  export type CategoryOrderByWithAggregationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    name?: SortOrder
    sortOrder?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CategoryCountOrderByAggregateInput
    _avg?: CategoryAvgOrderByAggregateInput
    _max?: CategoryMaxOrderByAggregateInput
    _min?: CategoryMinOrderByAggregateInput
    _sum?: CategorySumOrderByAggregateInput
  }

  export type CategoryScalarWhereWithAggregatesInput = {
    AND?: CategoryScalarWhereWithAggregatesInput | CategoryScalarWhereWithAggregatesInput[]
    OR?: CategoryScalarWhereWithAggregatesInput[]
    NOT?: CategoryScalarWhereWithAggregatesInput | CategoryScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Category"> | string
    tenantId?: StringWithAggregatesFilter<"Category"> | string
    name?: StringWithAggregatesFilter<"Category"> | string
    sortOrder?: IntWithAggregatesFilter<"Category"> | number
    isActive?: BoolWithAggregatesFilter<"Category"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Category"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Category"> | Date | string
  }

  export type ProductWhereInput = {
    AND?: ProductWhereInput | ProductWhereInput[]
    OR?: ProductWhereInput[]
    NOT?: ProductWhereInput | ProductWhereInput[]
    id?: StringFilter<"Product"> | string
    tenantId?: StringFilter<"Product"> | string
    categoryId?: StringFilter<"Product"> | string
    name?: StringFilter<"Product"> | string
    description?: StringNullableFilter<"Product"> | string | null
    price?: DecimalFilter<"Product"> | Decimal | DecimalJsLike | number | string
    imageUrl?: StringNullableFilter<"Product"> | string | null
    isAvailable?: BoolFilter<"Product"> | boolean
    sortOrder?: IntFilter<"Product"> | number
    prepTimeMinutes?: IntNullableFilter<"Product"> | number | null
    createdAt?: DateTimeFilter<"Product"> | Date | string
    updatedAt?: DateTimeFilter<"Product"> | Date | string
    category?: XOR<CategoryRelationFilter, CategoryWhereInput>
    modifierGroups?: ProductModifierGroupListRelationFilter
  }

  export type ProductOrderByWithRelationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    categoryId?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    price?: SortOrder
    imageUrl?: SortOrderInput | SortOrder
    isAvailable?: SortOrder
    sortOrder?: SortOrder
    prepTimeMinutes?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    category?: CategoryOrderByWithRelationInput
    modifierGroups?: ProductModifierGroupOrderByRelationAggregateInput
  }

  export type ProductWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ProductWhereInput | ProductWhereInput[]
    OR?: ProductWhereInput[]
    NOT?: ProductWhereInput | ProductWhereInput[]
    tenantId?: StringFilter<"Product"> | string
    categoryId?: StringFilter<"Product"> | string
    name?: StringFilter<"Product"> | string
    description?: StringNullableFilter<"Product"> | string | null
    price?: DecimalFilter<"Product"> | Decimal | DecimalJsLike | number | string
    imageUrl?: StringNullableFilter<"Product"> | string | null
    isAvailable?: BoolFilter<"Product"> | boolean
    sortOrder?: IntFilter<"Product"> | number
    prepTimeMinutes?: IntNullableFilter<"Product"> | number | null
    createdAt?: DateTimeFilter<"Product"> | Date | string
    updatedAt?: DateTimeFilter<"Product"> | Date | string
    category?: XOR<CategoryRelationFilter, CategoryWhereInput>
    modifierGroups?: ProductModifierGroupListRelationFilter
  }, "id">

  export type ProductOrderByWithAggregationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    categoryId?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    price?: SortOrder
    imageUrl?: SortOrderInput | SortOrder
    isAvailable?: SortOrder
    sortOrder?: SortOrder
    prepTimeMinutes?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ProductCountOrderByAggregateInput
    _avg?: ProductAvgOrderByAggregateInput
    _max?: ProductMaxOrderByAggregateInput
    _min?: ProductMinOrderByAggregateInput
    _sum?: ProductSumOrderByAggregateInput
  }

  export type ProductScalarWhereWithAggregatesInput = {
    AND?: ProductScalarWhereWithAggregatesInput | ProductScalarWhereWithAggregatesInput[]
    OR?: ProductScalarWhereWithAggregatesInput[]
    NOT?: ProductScalarWhereWithAggregatesInput | ProductScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Product"> | string
    tenantId?: StringWithAggregatesFilter<"Product"> | string
    categoryId?: StringWithAggregatesFilter<"Product"> | string
    name?: StringWithAggregatesFilter<"Product"> | string
    description?: StringNullableWithAggregatesFilter<"Product"> | string | null
    price?: DecimalWithAggregatesFilter<"Product"> | Decimal | DecimalJsLike | number | string
    imageUrl?: StringNullableWithAggregatesFilter<"Product"> | string | null
    isAvailable?: BoolWithAggregatesFilter<"Product"> | boolean
    sortOrder?: IntWithAggregatesFilter<"Product"> | number
    prepTimeMinutes?: IntNullableWithAggregatesFilter<"Product"> | number | null
    createdAt?: DateTimeWithAggregatesFilter<"Product"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Product"> | Date | string
  }

  export type ModifierGroupWhereInput = {
    AND?: ModifierGroupWhereInput | ModifierGroupWhereInput[]
    OR?: ModifierGroupWhereInput[]
    NOT?: ModifierGroupWhereInput | ModifierGroupWhereInput[]
    id?: StringFilter<"ModifierGroup"> | string
    tenantId?: StringFilter<"ModifierGroup"> | string
    name?: StringFilter<"ModifierGroup"> | string
    minSelections?: IntFilter<"ModifierGroup"> | number
    maxSelections?: IntFilter<"ModifierGroup"> | number
    isRequired?: BoolFilter<"ModifierGroup"> | boolean
    options?: ModifierOptionListRelationFilter
    products?: ProductModifierGroupListRelationFilter
  }

  export type ModifierGroupOrderByWithRelationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    name?: SortOrder
    minSelections?: SortOrder
    maxSelections?: SortOrder
    isRequired?: SortOrder
    options?: ModifierOptionOrderByRelationAggregateInput
    products?: ProductModifierGroupOrderByRelationAggregateInput
  }

  export type ModifierGroupWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ModifierGroupWhereInput | ModifierGroupWhereInput[]
    OR?: ModifierGroupWhereInput[]
    NOT?: ModifierGroupWhereInput | ModifierGroupWhereInput[]
    tenantId?: StringFilter<"ModifierGroup"> | string
    name?: StringFilter<"ModifierGroup"> | string
    minSelections?: IntFilter<"ModifierGroup"> | number
    maxSelections?: IntFilter<"ModifierGroup"> | number
    isRequired?: BoolFilter<"ModifierGroup"> | boolean
    options?: ModifierOptionListRelationFilter
    products?: ProductModifierGroupListRelationFilter
  }, "id">

  export type ModifierGroupOrderByWithAggregationInput = {
    id?: SortOrder
    tenantId?: SortOrder
    name?: SortOrder
    minSelections?: SortOrder
    maxSelections?: SortOrder
    isRequired?: SortOrder
    _count?: ModifierGroupCountOrderByAggregateInput
    _avg?: ModifierGroupAvgOrderByAggregateInput
    _max?: ModifierGroupMaxOrderByAggregateInput
    _min?: ModifierGroupMinOrderByAggregateInput
    _sum?: ModifierGroupSumOrderByAggregateInput
  }

  export type ModifierGroupScalarWhereWithAggregatesInput = {
    AND?: ModifierGroupScalarWhereWithAggregatesInput | ModifierGroupScalarWhereWithAggregatesInput[]
    OR?: ModifierGroupScalarWhereWithAggregatesInput[]
    NOT?: ModifierGroupScalarWhereWithAggregatesInput | ModifierGroupScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ModifierGroup"> | string
    tenantId?: StringWithAggregatesFilter<"ModifierGroup"> | string
    name?: StringWithAggregatesFilter<"ModifierGroup"> | string
    minSelections?: IntWithAggregatesFilter<"ModifierGroup"> | number
    maxSelections?: IntWithAggregatesFilter<"ModifierGroup"> | number
    isRequired?: BoolWithAggregatesFilter<"ModifierGroup"> | boolean
  }

  export type ModifierOptionWhereInput = {
    AND?: ModifierOptionWhereInput | ModifierOptionWhereInput[]
    OR?: ModifierOptionWhereInput[]
    NOT?: ModifierOptionWhereInput | ModifierOptionWhereInput[]
    id?: StringFilter<"ModifierOption"> | string
    groupId?: StringFilter<"ModifierOption"> | string
    name?: StringFilter<"ModifierOption"> | string
    priceDelta?: DecimalFilter<"ModifierOption"> | Decimal | DecimalJsLike | number | string
    isDefault?: BoolFilter<"ModifierOption"> | boolean
    group?: XOR<ModifierGroupRelationFilter, ModifierGroupWhereInput>
  }

  export type ModifierOptionOrderByWithRelationInput = {
    id?: SortOrder
    groupId?: SortOrder
    name?: SortOrder
    priceDelta?: SortOrder
    isDefault?: SortOrder
    group?: ModifierGroupOrderByWithRelationInput
  }

  export type ModifierOptionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ModifierOptionWhereInput | ModifierOptionWhereInput[]
    OR?: ModifierOptionWhereInput[]
    NOT?: ModifierOptionWhereInput | ModifierOptionWhereInput[]
    groupId?: StringFilter<"ModifierOption"> | string
    name?: StringFilter<"ModifierOption"> | string
    priceDelta?: DecimalFilter<"ModifierOption"> | Decimal | DecimalJsLike | number | string
    isDefault?: BoolFilter<"ModifierOption"> | boolean
    group?: XOR<ModifierGroupRelationFilter, ModifierGroupWhereInput>
  }, "id">

  export type ModifierOptionOrderByWithAggregationInput = {
    id?: SortOrder
    groupId?: SortOrder
    name?: SortOrder
    priceDelta?: SortOrder
    isDefault?: SortOrder
    _count?: ModifierOptionCountOrderByAggregateInput
    _avg?: ModifierOptionAvgOrderByAggregateInput
    _max?: ModifierOptionMaxOrderByAggregateInput
    _min?: ModifierOptionMinOrderByAggregateInput
    _sum?: ModifierOptionSumOrderByAggregateInput
  }

  export type ModifierOptionScalarWhereWithAggregatesInput = {
    AND?: ModifierOptionScalarWhereWithAggregatesInput | ModifierOptionScalarWhereWithAggregatesInput[]
    OR?: ModifierOptionScalarWhereWithAggregatesInput[]
    NOT?: ModifierOptionScalarWhereWithAggregatesInput | ModifierOptionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ModifierOption"> | string
    groupId?: StringWithAggregatesFilter<"ModifierOption"> | string
    name?: StringWithAggregatesFilter<"ModifierOption"> | string
    priceDelta?: DecimalWithAggregatesFilter<"ModifierOption"> | Decimal | DecimalJsLike | number | string
    isDefault?: BoolWithAggregatesFilter<"ModifierOption"> | boolean
  }

  export type ProductModifierGroupWhereInput = {
    AND?: ProductModifierGroupWhereInput | ProductModifierGroupWhereInput[]
    OR?: ProductModifierGroupWhereInput[]
    NOT?: ProductModifierGroupWhereInput | ProductModifierGroupWhereInput[]
    productId?: StringFilter<"ProductModifierGroup"> | string
    groupId?: StringFilter<"ProductModifierGroup"> | string
    product?: XOR<ProductRelationFilter, ProductWhereInput>
    group?: XOR<ModifierGroupRelationFilter, ModifierGroupWhereInput>
  }

  export type ProductModifierGroupOrderByWithRelationInput = {
    productId?: SortOrder
    groupId?: SortOrder
    product?: ProductOrderByWithRelationInput
    group?: ModifierGroupOrderByWithRelationInput
  }

  export type ProductModifierGroupWhereUniqueInput = Prisma.AtLeast<{
    productId_groupId?: ProductModifierGroupProductIdGroupIdCompoundUniqueInput
    AND?: ProductModifierGroupWhereInput | ProductModifierGroupWhereInput[]
    OR?: ProductModifierGroupWhereInput[]
    NOT?: ProductModifierGroupWhereInput | ProductModifierGroupWhereInput[]
    productId?: StringFilter<"ProductModifierGroup"> | string
    groupId?: StringFilter<"ProductModifierGroup"> | string
    product?: XOR<ProductRelationFilter, ProductWhereInput>
    group?: XOR<ModifierGroupRelationFilter, ModifierGroupWhereInput>
  }, "productId_groupId">

  export type ProductModifierGroupOrderByWithAggregationInput = {
    productId?: SortOrder
    groupId?: SortOrder
    _count?: ProductModifierGroupCountOrderByAggregateInput
    _max?: ProductModifierGroupMaxOrderByAggregateInput
    _min?: ProductModifierGroupMinOrderByAggregateInput
  }

  export type ProductModifierGroupScalarWhereWithAggregatesInput = {
    AND?: ProductModifierGroupScalarWhereWithAggregatesInput | ProductModifierGroupScalarWhereWithAggregatesInput[]
    OR?: ProductModifierGroupScalarWhereWithAggregatesInput[]
    NOT?: ProductModifierGroupScalarWhereWithAggregatesInput | ProductModifierGroupScalarWhereWithAggregatesInput[]
    productId?: StringWithAggregatesFilter<"ProductModifierGroup"> | string
    groupId?: StringWithAggregatesFilter<"ProductModifierGroup"> | string
  }

  export type CategoryCreateInput = {
    id?: string
    tenantId: string
    name: string
    sortOrder?: number
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    products?: ProductCreateNestedManyWithoutCategoryInput
  }

  export type CategoryUncheckedCreateInput = {
    id?: string
    tenantId: string
    name: string
    sortOrder?: number
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    products?: ProductUncheckedCreateNestedManyWithoutCategoryInput
  }

  export type CategoryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    products?: ProductUpdateManyWithoutCategoryNestedInput
  }

  export type CategoryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    products?: ProductUncheckedUpdateManyWithoutCategoryNestedInput
  }

  export type CategoryCreateManyInput = {
    id?: string
    tenantId: string
    name: string
    sortOrder?: number
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CategoryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductCreateInput = {
    id?: string
    tenantId: string
    name: string
    description?: string | null
    price: Decimal | DecimalJsLike | number | string
    imageUrl?: string | null
    isAvailable?: boolean
    sortOrder?: number
    prepTimeMinutes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    category: CategoryCreateNestedOneWithoutProductsInput
    modifierGroups?: ProductModifierGroupCreateNestedManyWithoutProductInput
  }

  export type ProductUncheckedCreateInput = {
    id?: string
    tenantId: string
    categoryId: string
    name: string
    description?: string | null
    price: Decimal | DecimalJsLike | number | string
    imageUrl?: string | null
    isAvailable?: boolean
    sortOrder?: number
    prepTimeMinutes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    modifierGroups?: ProductModifierGroupUncheckedCreateNestedManyWithoutProductInput
  }

  export type ProductUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    prepTimeMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: CategoryUpdateOneRequiredWithoutProductsNestedInput
    modifierGroups?: ProductModifierGroupUpdateManyWithoutProductNestedInput
  }

  export type ProductUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    categoryId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    prepTimeMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    modifierGroups?: ProductModifierGroupUncheckedUpdateManyWithoutProductNestedInput
  }

  export type ProductCreateManyInput = {
    id?: string
    tenantId: string
    categoryId: string
    name: string
    description?: string | null
    price: Decimal | DecimalJsLike | number | string
    imageUrl?: string | null
    isAvailable?: boolean
    sortOrder?: number
    prepTimeMinutes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProductUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    prepTimeMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    categoryId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    prepTimeMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ModifierGroupCreateInput = {
    id?: string
    tenantId: string
    name: string
    minSelections?: number
    maxSelections?: number
    isRequired?: boolean
    options?: ModifierOptionCreateNestedManyWithoutGroupInput
    products?: ProductModifierGroupCreateNestedManyWithoutGroupInput
  }

  export type ModifierGroupUncheckedCreateInput = {
    id?: string
    tenantId: string
    name: string
    minSelections?: number
    maxSelections?: number
    isRequired?: boolean
    options?: ModifierOptionUncheckedCreateNestedManyWithoutGroupInput
    products?: ProductModifierGroupUncheckedCreateNestedManyWithoutGroupInput
  }

  export type ModifierGroupUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    minSelections?: IntFieldUpdateOperationsInput | number
    maxSelections?: IntFieldUpdateOperationsInput | number
    isRequired?: BoolFieldUpdateOperationsInput | boolean
    options?: ModifierOptionUpdateManyWithoutGroupNestedInput
    products?: ProductModifierGroupUpdateManyWithoutGroupNestedInput
  }

  export type ModifierGroupUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    minSelections?: IntFieldUpdateOperationsInput | number
    maxSelections?: IntFieldUpdateOperationsInput | number
    isRequired?: BoolFieldUpdateOperationsInput | boolean
    options?: ModifierOptionUncheckedUpdateManyWithoutGroupNestedInput
    products?: ProductModifierGroupUncheckedUpdateManyWithoutGroupNestedInput
  }

  export type ModifierGroupCreateManyInput = {
    id?: string
    tenantId: string
    name: string
    minSelections?: number
    maxSelections?: number
    isRequired?: boolean
  }

  export type ModifierGroupUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    minSelections?: IntFieldUpdateOperationsInput | number
    maxSelections?: IntFieldUpdateOperationsInput | number
    isRequired?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ModifierGroupUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    minSelections?: IntFieldUpdateOperationsInput | number
    maxSelections?: IntFieldUpdateOperationsInput | number
    isRequired?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ModifierOptionCreateInput = {
    id?: string
    name: string
    priceDelta?: Decimal | DecimalJsLike | number | string
    isDefault?: boolean
    group: ModifierGroupCreateNestedOneWithoutOptionsInput
  }

  export type ModifierOptionUncheckedCreateInput = {
    id?: string
    groupId: string
    name: string
    priceDelta?: Decimal | DecimalJsLike | number | string
    isDefault?: boolean
  }

  export type ModifierOptionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    priceDelta?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    group?: ModifierGroupUpdateOneRequiredWithoutOptionsNestedInput
  }

  export type ModifierOptionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    priceDelta?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isDefault?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ModifierOptionCreateManyInput = {
    id?: string
    groupId: string
    name: string
    priceDelta?: Decimal | DecimalJsLike | number | string
    isDefault?: boolean
  }

  export type ModifierOptionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    priceDelta?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isDefault?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ModifierOptionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    priceDelta?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isDefault?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ProductModifierGroupCreateInput = {
    product: ProductCreateNestedOneWithoutModifierGroupsInput
    group: ModifierGroupCreateNestedOneWithoutProductsInput
  }

  export type ProductModifierGroupUncheckedCreateInput = {
    productId: string
    groupId: string
  }

  export type ProductModifierGroupUpdateInput = {
    product?: ProductUpdateOneRequiredWithoutModifierGroupsNestedInput
    group?: ModifierGroupUpdateOneRequiredWithoutProductsNestedInput
  }

  export type ProductModifierGroupUncheckedUpdateInput = {
    productId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
  }

  export type ProductModifierGroupCreateManyInput = {
    productId: string
    groupId: string
  }

  export type ProductModifierGroupUpdateManyMutationInput = {

  }

  export type ProductModifierGroupUncheckedUpdateManyInput = {
    productId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type ProductListRelationFilter = {
    every?: ProductWhereInput
    some?: ProductWhereInput
    none?: ProductWhereInput
  }

  export type ProductOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CategoryTenantIdNameCompoundUniqueInput = {
    tenantId: string
    name: string
  }

  export type CategoryCountOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    name?: SortOrder
    sortOrder?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CategoryAvgOrderByAggregateInput = {
    sortOrder?: SortOrder
  }

  export type CategoryMaxOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    name?: SortOrder
    sortOrder?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CategoryMinOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    name?: SortOrder
    sortOrder?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CategorySumOrderByAggregateInput = {
    sortOrder?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type CategoryRelationFilter = {
    is?: CategoryWhereInput
    isNot?: CategoryWhereInput
  }

  export type ProductModifierGroupListRelationFilter = {
    every?: ProductModifierGroupWhereInput
    some?: ProductModifierGroupWhereInput
    none?: ProductModifierGroupWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type ProductModifierGroupOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ProductCountOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    categoryId?: SortOrder
    name?: SortOrder
    description?: SortOrder
    price?: SortOrder
    imageUrl?: SortOrder
    isAvailable?: SortOrder
    sortOrder?: SortOrder
    prepTimeMinutes?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProductAvgOrderByAggregateInput = {
    price?: SortOrder
    sortOrder?: SortOrder
    prepTimeMinutes?: SortOrder
  }

  export type ProductMaxOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    categoryId?: SortOrder
    name?: SortOrder
    description?: SortOrder
    price?: SortOrder
    imageUrl?: SortOrder
    isAvailable?: SortOrder
    sortOrder?: SortOrder
    prepTimeMinutes?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProductMinOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    categoryId?: SortOrder
    name?: SortOrder
    description?: SortOrder
    price?: SortOrder
    imageUrl?: SortOrder
    isAvailable?: SortOrder
    sortOrder?: SortOrder
    prepTimeMinutes?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProductSumOrderByAggregateInput = {
    price?: SortOrder
    sortOrder?: SortOrder
    prepTimeMinutes?: SortOrder
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type ModifierOptionListRelationFilter = {
    every?: ModifierOptionWhereInput
    some?: ModifierOptionWhereInput
    none?: ModifierOptionWhereInput
  }

  export type ModifierOptionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ModifierGroupCountOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    name?: SortOrder
    minSelections?: SortOrder
    maxSelections?: SortOrder
    isRequired?: SortOrder
  }

  export type ModifierGroupAvgOrderByAggregateInput = {
    minSelections?: SortOrder
    maxSelections?: SortOrder
  }

  export type ModifierGroupMaxOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    name?: SortOrder
    minSelections?: SortOrder
    maxSelections?: SortOrder
    isRequired?: SortOrder
  }

  export type ModifierGroupMinOrderByAggregateInput = {
    id?: SortOrder
    tenantId?: SortOrder
    name?: SortOrder
    minSelections?: SortOrder
    maxSelections?: SortOrder
    isRequired?: SortOrder
  }

  export type ModifierGroupSumOrderByAggregateInput = {
    minSelections?: SortOrder
    maxSelections?: SortOrder
  }

  export type ModifierGroupRelationFilter = {
    is?: ModifierGroupWhereInput
    isNot?: ModifierGroupWhereInput
  }

  export type ModifierOptionCountOrderByAggregateInput = {
    id?: SortOrder
    groupId?: SortOrder
    name?: SortOrder
    priceDelta?: SortOrder
    isDefault?: SortOrder
  }

  export type ModifierOptionAvgOrderByAggregateInput = {
    priceDelta?: SortOrder
  }

  export type ModifierOptionMaxOrderByAggregateInput = {
    id?: SortOrder
    groupId?: SortOrder
    name?: SortOrder
    priceDelta?: SortOrder
    isDefault?: SortOrder
  }

  export type ModifierOptionMinOrderByAggregateInput = {
    id?: SortOrder
    groupId?: SortOrder
    name?: SortOrder
    priceDelta?: SortOrder
    isDefault?: SortOrder
  }

  export type ModifierOptionSumOrderByAggregateInput = {
    priceDelta?: SortOrder
  }

  export type ProductRelationFilter = {
    is?: ProductWhereInput
    isNot?: ProductWhereInput
  }

  export type ProductModifierGroupProductIdGroupIdCompoundUniqueInput = {
    productId: string
    groupId: string
  }

  export type ProductModifierGroupCountOrderByAggregateInput = {
    productId?: SortOrder
    groupId?: SortOrder
  }

  export type ProductModifierGroupMaxOrderByAggregateInput = {
    productId?: SortOrder
    groupId?: SortOrder
  }

  export type ProductModifierGroupMinOrderByAggregateInput = {
    productId?: SortOrder
    groupId?: SortOrder
  }

  export type ProductCreateNestedManyWithoutCategoryInput = {
    create?: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput> | ProductCreateWithoutCategoryInput[] | ProductUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutCategoryInput | ProductCreateOrConnectWithoutCategoryInput[]
    createMany?: ProductCreateManyCategoryInputEnvelope
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
  }

  export type ProductUncheckedCreateNestedManyWithoutCategoryInput = {
    create?: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput> | ProductCreateWithoutCategoryInput[] | ProductUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutCategoryInput | ProductCreateOrConnectWithoutCategoryInput[]
    createMany?: ProductCreateManyCategoryInputEnvelope
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type ProductUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput> | ProductCreateWithoutCategoryInput[] | ProductUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutCategoryInput | ProductCreateOrConnectWithoutCategoryInput[]
    upsert?: ProductUpsertWithWhereUniqueWithoutCategoryInput | ProductUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: ProductCreateManyCategoryInputEnvelope
    set?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    disconnect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    delete?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    update?: ProductUpdateWithWhereUniqueWithoutCategoryInput | ProductUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: ProductUpdateManyWithWhereWithoutCategoryInput | ProductUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: ProductScalarWhereInput | ProductScalarWhereInput[]
  }

  export type ProductUncheckedUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput> | ProductCreateWithoutCategoryInput[] | ProductUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutCategoryInput | ProductCreateOrConnectWithoutCategoryInput[]
    upsert?: ProductUpsertWithWhereUniqueWithoutCategoryInput | ProductUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: ProductCreateManyCategoryInputEnvelope
    set?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    disconnect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    delete?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    update?: ProductUpdateWithWhereUniqueWithoutCategoryInput | ProductUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: ProductUpdateManyWithWhereWithoutCategoryInput | ProductUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: ProductScalarWhereInput | ProductScalarWhereInput[]
  }

  export type CategoryCreateNestedOneWithoutProductsInput = {
    create?: XOR<CategoryCreateWithoutProductsInput, CategoryUncheckedCreateWithoutProductsInput>
    connectOrCreate?: CategoryCreateOrConnectWithoutProductsInput
    connect?: CategoryWhereUniqueInput
  }

  export type ProductModifierGroupCreateNestedManyWithoutProductInput = {
    create?: XOR<ProductModifierGroupCreateWithoutProductInput, ProductModifierGroupUncheckedCreateWithoutProductInput> | ProductModifierGroupCreateWithoutProductInput[] | ProductModifierGroupUncheckedCreateWithoutProductInput[]
    connectOrCreate?: ProductModifierGroupCreateOrConnectWithoutProductInput | ProductModifierGroupCreateOrConnectWithoutProductInput[]
    createMany?: ProductModifierGroupCreateManyProductInputEnvelope
    connect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
  }

  export type ProductModifierGroupUncheckedCreateNestedManyWithoutProductInput = {
    create?: XOR<ProductModifierGroupCreateWithoutProductInput, ProductModifierGroupUncheckedCreateWithoutProductInput> | ProductModifierGroupCreateWithoutProductInput[] | ProductModifierGroupUncheckedCreateWithoutProductInput[]
    connectOrCreate?: ProductModifierGroupCreateOrConnectWithoutProductInput | ProductModifierGroupCreateOrConnectWithoutProductInput[]
    createMany?: ProductModifierGroupCreateManyProductInputEnvelope
    connect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type CategoryUpdateOneRequiredWithoutProductsNestedInput = {
    create?: XOR<CategoryCreateWithoutProductsInput, CategoryUncheckedCreateWithoutProductsInput>
    connectOrCreate?: CategoryCreateOrConnectWithoutProductsInput
    upsert?: CategoryUpsertWithoutProductsInput
    connect?: CategoryWhereUniqueInput
    update?: XOR<XOR<CategoryUpdateToOneWithWhereWithoutProductsInput, CategoryUpdateWithoutProductsInput>, CategoryUncheckedUpdateWithoutProductsInput>
  }

  export type ProductModifierGroupUpdateManyWithoutProductNestedInput = {
    create?: XOR<ProductModifierGroupCreateWithoutProductInput, ProductModifierGroupUncheckedCreateWithoutProductInput> | ProductModifierGroupCreateWithoutProductInput[] | ProductModifierGroupUncheckedCreateWithoutProductInput[]
    connectOrCreate?: ProductModifierGroupCreateOrConnectWithoutProductInput | ProductModifierGroupCreateOrConnectWithoutProductInput[]
    upsert?: ProductModifierGroupUpsertWithWhereUniqueWithoutProductInput | ProductModifierGroupUpsertWithWhereUniqueWithoutProductInput[]
    createMany?: ProductModifierGroupCreateManyProductInputEnvelope
    set?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    disconnect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    delete?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    connect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    update?: ProductModifierGroupUpdateWithWhereUniqueWithoutProductInput | ProductModifierGroupUpdateWithWhereUniqueWithoutProductInput[]
    updateMany?: ProductModifierGroupUpdateManyWithWhereWithoutProductInput | ProductModifierGroupUpdateManyWithWhereWithoutProductInput[]
    deleteMany?: ProductModifierGroupScalarWhereInput | ProductModifierGroupScalarWhereInput[]
  }

  export type ProductModifierGroupUncheckedUpdateManyWithoutProductNestedInput = {
    create?: XOR<ProductModifierGroupCreateWithoutProductInput, ProductModifierGroupUncheckedCreateWithoutProductInput> | ProductModifierGroupCreateWithoutProductInput[] | ProductModifierGroupUncheckedCreateWithoutProductInput[]
    connectOrCreate?: ProductModifierGroupCreateOrConnectWithoutProductInput | ProductModifierGroupCreateOrConnectWithoutProductInput[]
    upsert?: ProductModifierGroupUpsertWithWhereUniqueWithoutProductInput | ProductModifierGroupUpsertWithWhereUniqueWithoutProductInput[]
    createMany?: ProductModifierGroupCreateManyProductInputEnvelope
    set?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    disconnect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    delete?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    connect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    update?: ProductModifierGroupUpdateWithWhereUniqueWithoutProductInput | ProductModifierGroupUpdateWithWhereUniqueWithoutProductInput[]
    updateMany?: ProductModifierGroupUpdateManyWithWhereWithoutProductInput | ProductModifierGroupUpdateManyWithWhereWithoutProductInput[]
    deleteMany?: ProductModifierGroupScalarWhereInput | ProductModifierGroupScalarWhereInput[]
  }

  export type ModifierOptionCreateNestedManyWithoutGroupInput = {
    create?: XOR<ModifierOptionCreateWithoutGroupInput, ModifierOptionUncheckedCreateWithoutGroupInput> | ModifierOptionCreateWithoutGroupInput[] | ModifierOptionUncheckedCreateWithoutGroupInput[]
    connectOrCreate?: ModifierOptionCreateOrConnectWithoutGroupInput | ModifierOptionCreateOrConnectWithoutGroupInput[]
    createMany?: ModifierOptionCreateManyGroupInputEnvelope
    connect?: ModifierOptionWhereUniqueInput | ModifierOptionWhereUniqueInput[]
  }

  export type ProductModifierGroupCreateNestedManyWithoutGroupInput = {
    create?: XOR<ProductModifierGroupCreateWithoutGroupInput, ProductModifierGroupUncheckedCreateWithoutGroupInput> | ProductModifierGroupCreateWithoutGroupInput[] | ProductModifierGroupUncheckedCreateWithoutGroupInput[]
    connectOrCreate?: ProductModifierGroupCreateOrConnectWithoutGroupInput | ProductModifierGroupCreateOrConnectWithoutGroupInput[]
    createMany?: ProductModifierGroupCreateManyGroupInputEnvelope
    connect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
  }

  export type ModifierOptionUncheckedCreateNestedManyWithoutGroupInput = {
    create?: XOR<ModifierOptionCreateWithoutGroupInput, ModifierOptionUncheckedCreateWithoutGroupInput> | ModifierOptionCreateWithoutGroupInput[] | ModifierOptionUncheckedCreateWithoutGroupInput[]
    connectOrCreate?: ModifierOptionCreateOrConnectWithoutGroupInput | ModifierOptionCreateOrConnectWithoutGroupInput[]
    createMany?: ModifierOptionCreateManyGroupInputEnvelope
    connect?: ModifierOptionWhereUniqueInput | ModifierOptionWhereUniqueInput[]
  }

  export type ProductModifierGroupUncheckedCreateNestedManyWithoutGroupInput = {
    create?: XOR<ProductModifierGroupCreateWithoutGroupInput, ProductModifierGroupUncheckedCreateWithoutGroupInput> | ProductModifierGroupCreateWithoutGroupInput[] | ProductModifierGroupUncheckedCreateWithoutGroupInput[]
    connectOrCreate?: ProductModifierGroupCreateOrConnectWithoutGroupInput | ProductModifierGroupCreateOrConnectWithoutGroupInput[]
    createMany?: ProductModifierGroupCreateManyGroupInputEnvelope
    connect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
  }

  export type ModifierOptionUpdateManyWithoutGroupNestedInput = {
    create?: XOR<ModifierOptionCreateWithoutGroupInput, ModifierOptionUncheckedCreateWithoutGroupInput> | ModifierOptionCreateWithoutGroupInput[] | ModifierOptionUncheckedCreateWithoutGroupInput[]
    connectOrCreate?: ModifierOptionCreateOrConnectWithoutGroupInput | ModifierOptionCreateOrConnectWithoutGroupInput[]
    upsert?: ModifierOptionUpsertWithWhereUniqueWithoutGroupInput | ModifierOptionUpsertWithWhereUniqueWithoutGroupInput[]
    createMany?: ModifierOptionCreateManyGroupInputEnvelope
    set?: ModifierOptionWhereUniqueInput | ModifierOptionWhereUniqueInput[]
    disconnect?: ModifierOptionWhereUniqueInput | ModifierOptionWhereUniqueInput[]
    delete?: ModifierOptionWhereUniqueInput | ModifierOptionWhereUniqueInput[]
    connect?: ModifierOptionWhereUniqueInput | ModifierOptionWhereUniqueInput[]
    update?: ModifierOptionUpdateWithWhereUniqueWithoutGroupInput | ModifierOptionUpdateWithWhereUniqueWithoutGroupInput[]
    updateMany?: ModifierOptionUpdateManyWithWhereWithoutGroupInput | ModifierOptionUpdateManyWithWhereWithoutGroupInput[]
    deleteMany?: ModifierOptionScalarWhereInput | ModifierOptionScalarWhereInput[]
  }

  export type ProductModifierGroupUpdateManyWithoutGroupNestedInput = {
    create?: XOR<ProductModifierGroupCreateWithoutGroupInput, ProductModifierGroupUncheckedCreateWithoutGroupInput> | ProductModifierGroupCreateWithoutGroupInput[] | ProductModifierGroupUncheckedCreateWithoutGroupInput[]
    connectOrCreate?: ProductModifierGroupCreateOrConnectWithoutGroupInput | ProductModifierGroupCreateOrConnectWithoutGroupInput[]
    upsert?: ProductModifierGroupUpsertWithWhereUniqueWithoutGroupInput | ProductModifierGroupUpsertWithWhereUniqueWithoutGroupInput[]
    createMany?: ProductModifierGroupCreateManyGroupInputEnvelope
    set?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    disconnect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    delete?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    connect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    update?: ProductModifierGroupUpdateWithWhereUniqueWithoutGroupInput | ProductModifierGroupUpdateWithWhereUniqueWithoutGroupInput[]
    updateMany?: ProductModifierGroupUpdateManyWithWhereWithoutGroupInput | ProductModifierGroupUpdateManyWithWhereWithoutGroupInput[]
    deleteMany?: ProductModifierGroupScalarWhereInput | ProductModifierGroupScalarWhereInput[]
  }

  export type ModifierOptionUncheckedUpdateManyWithoutGroupNestedInput = {
    create?: XOR<ModifierOptionCreateWithoutGroupInput, ModifierOptionUncheckedCreateWithoutGroupInput> | ModifierOptionCreateWithoutGroupInput[] | ModifierOptionUncheckedCreateWithoutGroupInput[]
    connectOrCreate?: ModifierOptionCreateOrConnectWithoutGroupInput | ModifierOptionCreateOrConnectWithoutGroupInput[]
    upsert?: ModifierOptionUpsertWithWhereUniqueWithoutGroupInput | ModifierOptionUpsertWithWhereUniqueWithoutGroupInput[]
    createMany?: ModifierOptionCreateManyGroupInputEnvelope
    set?: ModifierOptionWhereUniqueInput | ModifierOptionWhereUniqueInput[]
    disconnect?: ModifierOptionWhereUniqueInput | ModifierOptionWhereUniqueInput[]
    delete?: ModifierOptionWhereUniqueInput | ModifierOptionWhereUniqueInput[]
    connect?: ModifierOptionWhereUniqueInput | ModifierOptionWhereUniqueInput[]
    update?: ModifierOptionUpdateWithWhereUniqueWithoutGroupInput | ModifierOptionUpdateWithWhereUniqueWithoutGroupInput[]
    updateMany?: ModifierOptionUpdateManyWithWhereWithoutGroupInput | ModifierOptionUpdateManyWithWhereWithoutGroupInput[]
    deleteMany?: ModifierOptionScalarWhereInput | ModifierOptionScalarWhereInput[]
  }

  export type ProductModifierGroupUncheckedUpdateManyWithoutGroupNestedInput = {
    create?: XOR<ProductModifierGroupCreateWithoutGroupInput, ProductModifierGroupUncheckedCreateWithoutGroupInput> | ProductModifierGroupCreateWithoutGroupInput[] | ProductModifierGroupUncheckedCreateWithoutGroupInput[]
    connectOrCreate?: ProductModifierGroupCreateOrConnectWithoutGroupInput | ProductModifierGroupCreateOrConnectWithoutGroupInput[]
    upsert?: ProductModifierGroupUpsertWithWhereUniqueWithoutGroupInput | ProductModifierGroupUpsertWithWhereUniqueWithoutGroupInput[]
    createMany?: ProductModifierGroupCreateManyGroupInputEnvelope
    set?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    disconnect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    delete?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    connect?: ProductModifierGroupWhereUniqueInput | ProductModifierGroupWhereUniqueInput[]
    update?: ProductModifierGroupUpdateWithWhereUniqueWithoutGroupInput | ProductModifierGroupUpdateWithWhereUniqueWithoutGroupInput[]
    updateMany?: ProductModifierGroupUpdateManyWithWhereWithoutGroupInput | ProductModifierGroupUpdateManyWithWhereWithoutGroupInput[]
    deleteMany?: ProductModifierGroupScalarWhereInput | ProductModifierGroupScalarWhereInput[]
  }

  export type ModifierGroupCreateNestedOneWithoutOptionsInput = {
    create?: XOR<ModifierGroupCreateWithoutOptionsInput, ModifierGroupUncheckedCreateWithoutOptionsInput>
    connectOrCreate?: ModifierGroupCreateOrConnectWithoutOptionsInput
    connect?: ModifierGroupWhereUniqueInput
  }

  export type ModifierGroupUpdateOneRequiredWithoutOptionsNestedInput = {
    create?: XOR<ModifierGroupCreateWithoutOptionsInput, ModifierGroupUncheckedCreateWithoutOptionsInput>
    connectOrCreate?: ModifierGroupCreateOrConnectWithoutOptionsInput
    upsert?: ModifierGroupUpsertWithoutOptionsInput
    connect?: ModifierGroupWhereUniqueInput
    update?: XOR<XOR<ModifierGroupUpdateToOneWithWhereWithoutOptionsInput, ModifierGroupUpdateWithoutOptionsInput>, ModifierGroupUncheckedUpdateWithoutOptionsInput>
  }

  export type ProductCreateNestedOneWithoutModifierGroupsInput = {
    create?: XOR<ProductCreateWithoutModifierGroupsInput, ProductUncheckedCreateWithoutModifierGroupsInput>
    connectOrCreate?: ProductCreateOrConnectWithoutModifierGroupsInput
    connect?: ProductWhereUniqueInput
  }

  export type ModifierGroupCreateNestedOneWithoutProductsInput = {
    create?: XOR<ModifierGroupCreateWithoutProductsInput, ModifierGroupUncheckedCreateWithoutProductsInput>
    connectOrCreate?: ModifierGroupCreateOrConnectWithoutProductsInput
    connect?: ModifierGroupWhereUniqueInput
  }

  export type ProductUpdateOneRequiredWithoutModifierGroupsNestedInput = {
    create?: XOR<ProductCreateWithoutModifierGroupsInput, ProductUncheckedCreateWithoutModifierGroupsInput>
    connectOrCreate?: ProductCreateOrConnectWithoutModifierGroupsInput
    upsert?: ProductUpsertWithoutModifierGroupsInput
    connect?: ProductWhereUniqueInput
    update?: XOR<XOR<ProductUpdateToOneWithWhereWithoutModifierGroupsInput, ProductUpdateWithoutModifierGroupsInput>, ProductUncheckedUpdateWithoutModifierGroupsInput>
  }

  export type ModifierGroupUpdateOneRequiredWithoutProductsNestedInput = {
    create?: XOR<ModifierGroupCreateWithoutProductsInput, ModifierGroupUncheckedCreateWithoutProductsInput>
    connectOrCreate?: ModifierGroupCreateOrConnectWithoutProductsInput
    upsert?: ModifierGroupUpsertWithoutProductsInput
    connect?: ModifierGroupWhereUniqueInput
    update?: XOR<XOR<ModifierGroupUpdateToOneWithWhereWithoutProductsInput, ModifierGroupUpdateWithoutProductsInput>, ModifierGroupUncheckedUpdateWithoutProductsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedDecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type ProductCreateWithoutCategoryInput = {
    id?: string
    tenantId: string
    name: string
    description?: string | null
    price: Decimal | DecimalJsLike | number | string
    imageUrl?: string | null
    isAvailable?: boolean
    sortOrder?: number
    prepTimeMinutes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    modifierGroups?: ProductModifierGroupCreateNestedManyWithoutProductInput
  }

  export type ProductUncheckedCreateWithoutCategoryInput = {
    id?: string
    tenantId: string
    name: string
    description?: string | null
    price: Decimal | DecimalJsLike | number | string
    imageUrl?: string | null
    isAvailable?: boolean
    sortOrder?: number
    prepTimeMinutes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    modifierGroups?: ProductModifierGroupUncheckedCreateNestedManyWithoutProductInput
  }

  export type ProductCreateOrConnectWithoutCategoryInput = {
    where: ProductWhereUniqueInput
    create: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput>
  }

  export type ProductCreateManyCategoryInputEnvelope = {
    data: ProductCreateManyCategoryInput | ProductCreateManyCategoryInput[]
    skipDuplicates?: boolean
  }

  export type ProductUpsertWithWhereUniqueWithoutCategoryInput = {
    where: ProductWhereUniqueInput
    update: XOR<ProductUpdateWithoutCategoryInput, ProductUncheckedUpdateWithoutCategoryInput>
    create: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput>
  }

  export type ProductUpdateWithWhereUniqueWithoutCategoryInput = {
    where: ProductWhereUniqueInput
    data: XOR<ProductUpdateWithoutCategoryInput, ProductUncheckedUpdateWithoutCategoryInput>
  }

  export type ProductUpdateManyWithWhereWithoutCategoryInput = {
    where: ProductScalarWhereInput
    data: XOR<ProductUpdateManyMutationInput, ProductUncheckedUpdateManyWithoutCategoryInput>
  }

  export type ProductScalarWhereInput = {
    AND?: ProductScalarWhereInput | ProductScalarWhereInput[]
    OR?: ProductScalarWhereInput[]
    NOT?: ProductScalarWhereInput | ProductScalarWhereInput[]
    id?: StringFilter<"Product"> | string
    tenantId?: StringFilter<"Product"> | string
    categoryId?: StringFilter<"Product"> | string
    name?: StringFilter<"Product"> | string
    description?: StringNullableFilter<"Product"> | string | null
    price?: DecimalFilter<"Product"> | Decimal | DecimalJsLike | number | string
    imageUrl?: StringNullableFilter<"Product"> | string | null
    isAvailable?: BoolFilter<"Product"> | boolean
    sortOrder?: IntFilter<"Product"> | number
    prepTimeMinutes?: IntNullableFilter<"Product"> | number | null
    createdAt?: DateTimeFilter<"Product"> | Date | string
    updatedAt?: DateTimeFilter<"Product"> | Date | string
  }

  export type CategoryCreateWithoutProductsInput = {
    id?: string
    tenantId: string
    name: string
    sortOrder?: number
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CategoryUncheckedCreateWithoutProductsInput = {
    id?: string
    tenantId: string
    name: string
    sortOrder?: number
    isActive?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CategoryCreateOrConnectWithoutProductsInput = {
    where: CategoryWhereUniqueInput
    create: XOR<CategoryCreateWithoutProductsInput, CategoryUncheckedCreateWithoutProductsInput>
  }

  export type ProductModifierGroupCreateWithoutProductInput = {
    group: ModifierGroupCreateNestedOneWithoutProductsInput
  }

  export type ProductModifierGroupUncheckedCreateWithoutProductInput = {
    groupId: string
  }

  export type ProductModifierGroupCreateOrConnectWithoutProductInput = {
    where: ProductModifierGroupWhereUniqueInput
    create: XOR<ProductModifierGroupCreateWithoutProductInput, ProductModifierGroupUncheckedCreateWithoutProductInput>
  }

  export type ProductModifierGroupCreateManyProductInputEnvelope = {
    data: ProductModifierGroupCreateManyProductInput | ProductModifierGroupCreateManyProductInput[]
    skipDuplicates?: boolean
  }

  export type CategoryUpsertWithoutProductsInput = {
    update: XOR<CategoryUpdateWithoutProductsInput, CategoryUncheckedUpdateWithoutProductsInput>
    create: XOR<CategoryCreateWithoutProductsInput, CategoryUncheckedCreateWithoutProductsInput>
    where?: CategoryWhereInput
  }

  export type CategoryUpdateToOneWithWhereWithoutProductsInput = {
    where?: CategoryWhereInput
    data: XOR<CategoryUpdateWithoutProductsInput, CategoryUncheckedUpdateWithoutProductsInput>
  }

  export type CategoryUpdateWithoutProductsInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryUncheckedUpdateWithoutProductsInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    sortOrder?: IntFieldUpdateOperationsInput | number
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductModifierGroupUpsertWithWhereUniqueWithoutProductInput = {
    where: ProductModifierGroupWhereUniqueInput
    update: XOR<ProductModifierGroupUpdateWithoutProductInput, ProductModifierGroupUncheckedUpdateWithoutProductInput>
    create: XOR<ProductModifierGroupCreateWithoutProductInput, ProductModifierGroupUncheckedCreateWithoutProductInput>
  }

  export type ProductModifierGroupUpdateWithWhereUniqueWithoutProductInput = {
    where: ProductModifierGroupWhereUniqueInput
    data: XOR<ProductModifierGroupUpdateWithoutProductInput, ProductModifierGroupUncheckedUpdateWithoutProductInput>
  }

  export type ProductModifierGroupUpdateManyWithWhereWithoutProductInput = {
    where: ProductModifierGroupScalarWhereInput
    data: XOR<ProductModifierGroupUpdateManyMutationInput, ProductModifierGroupUncheckedUpdateManyWithoutProductInput>
  }

  export type ProductModifierGroupScalarWhereInput = {
    AND?: ProductModifierGroupScalarWhereInput | ProductModifierGroupScalarWhereInput[]
    OR?: ProductModifierGroupScalarWhereInput[]
    NOT?: ProductModifierGroupScalarWhereInput | ProductModifierGroupScalarWhereInput[]
    productId?: StringFilter<"ProductModifierGroup"> | string
    groupId?: StringFilter<"ProductModifierGroup"> | string
  }

  export type ModifierOptionCreateWithoutGroupInput = {
    id?: string
    name: string
    priceDelta?: Decimal | DecimalJsLike | number | string
    isDefault?: boolean
  }

  export type ModifierOptionUncheckedCreateWithoutGroupInput = {
    id?: string
    name: string
    priceDelta?: Decimal | DecimalJsLike | number | string
    isDefault?: boolean
  }

  export type ModifierOptionCreateOrConnectWithoutGroupInput = {
    where: ModifierOptionWhereUniqueInput
    create: XOR<ModifierOptionCreateWithoutGroupInput, ModifierOptionUncheckedCreateWithoutGroupInput>
  }

  export type ModifierOptionCreateManyGroupInputEnvelope = {
    data: ModifierOptionCreateManyGroupInput | ModifierOptionCreateManyGroupInput[]
    skipDuplicates?: boolean
  }

  export type ProductModifierGroupCreateWithoutGroupInput = {
    product: ProductCreateNestedOneWithoutModifierGroupsInput
  }

  export type ProductModifierGroupUncheckedCreateWithoutGroupInput = {
    productId: string
  }

  export type ProductModifierGroupCreateOrConnectWithoutGroupInput = {
    where: ProductModifierGroupWhereUniqueInput
    create: XOR<ProductModifierGroupCreateWithoutGroupInput, ProductModifierGroupUncheckedCreateWithoutGroupInput>
  }

  export type ProductModifierGroupCreateManyGroupInputEnvelope = {
    data: ProductModifierGroupCreateManyGroupInput | ProductModifierGroupCreateManyGroupInput[]
    skipDuplicates?: boolean
  }

  export type ModifierOptionUpsertWithWhereUniqueWithoutGroupInput = {
    where: ModifierOptionWhereUniqueInput
    update: XOR<ModifierOptionUpdateWithoutGroupInput, ModifierOptionUncheckedUpdateWithoutGroupInput>
    create: XOR<ModifierOptionCreateWithoutGroupInput, ModifierOptionUncheckedCreateWithoutGroupInput>
  }

  export type ModifierOptionUpdateWithWhereUniqueWithoutGroupInput = {
    where: ModifierOptionWhereUniqueInput
    data: XOR<ModifierOptionUpdateWithoutGroupInput, ModifierOptionUncheckedUpdateWithoutGroupInput>
  }

  export type ModifierOptionUpdateManyWithWhereWithoutGroupInput = {
    where: ModifierOptionScalarWhereInput
    data: XOR<ModifierOptionUpdateManyMutationInput, ModifierOptionUncheckedUpdateManyWithoutGroupInput>
  }

  export type ModifierOptionScalarWhereInput = {
    AND?: ModifierOptionScalarWhereInput | ModifierOptionScalarWhereInput[]
    OR?: ModifierOptionScalarWhereInput[]
    NOT?: ModifierOptionScalarWhereInput | ModifierOptionScalarWhereInput[]
    id?: StringFilter<"ModifierOption"> | string
    groupId?: StringFilter<"ModifierOption"> | string
    name?: StringFilter<"ModifierOption"> | string
    priceDelta?: DecimalFilter<"ModifierOption"> | Decimal | DecimalJsLike | number | string
    isDefault?: BoolFilter<"ModifierOption"> | boolean
  }

  export type ProductModifierGroupUpsertWithWhereUniqueWithoutGroupInput = {
    where: ProductModifierGroupWhereUniqueInput
    update: XOR<ProductModifierGroupUpdateWithoutGroupInput, ProductModifierGroupUncheckedUpdateWithoutGroupInput>
    create: XOR<ProductModifierGroupCreateWithoutGroupInput, ProductModifierGroupUncheckedCreateWithoutGroupInput>
  }

  export type ProductModifierGroupUpdateWithWhereUniqueWithoutGroupInput = {
    where: ProductModifierGroupWhereUniqueInput
    data: XOR<ProductModifierGroupUpdateWithoutGroupInput, ProductModifierGroupUncheckedUpdateWithoutGroupInput>
  }

  export type ProductModifierGroupUpdateManyWithWhereWithoutGroupInput = {
    where: ProductModifierGroupScalarWhereInput
    data: XOR<ProductModifierGroupUpdateManyMutationInput, ProductModifierGroupUncheckedUpdateManyWithoutGroupInput>
  }

  export type ModifierGroupCreateWithoutOptionsInput = {
    id?: string
    tenantId: string
    name: string
    minSelections?: number
    maxSelections?: number
    isRequired?: boolean
    products?: ProductModifierGroupCreateNestedManyWithoutGroupInput
  }

  export type ModifierGroupUncheckedCreateWithoutOptionsInput = {
    id?: string
    tenantId: string
    name: string
    minSelections?: number
    maxSelections?: number
    isRequired?: boolean
    products?: ProductModifierGroupUncheckedCreateNestedManyWithoutGroupInput
  }

  export type ModifierGroupCreateOrConnectWithoutOptionsInput = {
    where: ModifierGroupWhereUniqueInput
    create: XOR<ModifierGroupCreateWithoutOptionsInput, ModifierGroupUncheckedCreateWithoutOptionsInput>
  }

  export type ModifierGroupUpsertWithoutOptionsInput = {
    update: XOR<ModifierGroupUpdateWithoutOptionsInput, ModifierGroupUncheckedUpdateWithoutOptionsInput>
    create: XOR<ModifierGroupCreateWithoutOptionsInput, ModifierGroupUncheckedCreateWithoutOptionsInput>
    where?: ModifierGroupWhereInput
  }

  export type ModifierGroupUpdateToOneWithWhereWithoutOptionsInput = {
    where?: ModifierGroupWhereInput
    data: XOR<ModifierGroupUpdateWithoutOptionsInput, ModifierGroupUncheckedUpdateWithoutOptionsInput>
  }

  export type ModifierGroupUpdateWithoutOptionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    minSelections?: IntFieldUpdateOperationsInput | number
    maxSelections?: IntFieldUpdateOperationsInput | number
    isRequired?: BoolFieldUpdateOperationsInput | boolean
    products?: ProductModifierGroupUpdateManyWithoutGroupNestedInput
  }

  export type ModifierGroupUncheckedUpdateWithoutOptionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    minSelections?: IntFieldUpdateOperationsInput | number
    maxSelections?: IntFieldUpdateOperationsInput | number
    isRequired?: BoolFieldUpdateOperationsInput | boolean
    products?: ProductModifierGroupUncheckedUpdateManyWithoutGroupNestedInput
  }

  export type ProductCreateWithoutModifierGroupsInput = {
    id?: string
    tenantId: string
    name: string
    description?: string | null
    price: Decimal | DecimalJsLike | number | string
    imageUrl?: string | null
    isAvailable?: boolean
    sortOrder?: number
    prepTimeMinutes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    category: CategoryCreateNestedOneWithoutProductsInput
  }

  export type ProductUncheckedCreateWithoutModifierGroupsInput = {
    id?: string
    tenantId: string
    categoryId: string
    name: string
    description?: string | null
    price: Decimal | DecimalJsLike | number | string
    imageUrl?: string | null
    isAvailable?: boolean
    sortOrder?: number
    prepTimeMinutes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProductCreateOrConnectWithoutModifierGroupsInput = {
    where: ProductWhereUniqueInput
    create: XOR<ProductCreateWithoutModifierGroupsInput, ProductUncheckedCreateWithoutModifierGroupsInput>
  }

  export type ModifierGroupCreateWithoutProductsInput = {
    id?: string
    tenantId: string
    name: string
    minSelections?: number
    maxSelections?: number
    isRequired?: boolean
    options?: ModifierOptionCreateNestedManyWithoutGroupInput
  }

  export type ModifierGroupUncheckedCreateWithoutProductsInput = {
    id?: string
    tenantId: string
    name: string
    minSelections?: number
    maxSelections?: number
    isRequired?: boolean
    options?: ModifierOptionUncheckedCreateNestedManyWithoutGroupInput
  }

  export type ModifierGroupCreateOrConnectWithoutProductsInput = {
    where: ModifierGroupWhereUniqueInput
    create: XOR<ModifierGroupCreateWithoutProductsInput, ModifierGroupUncheckedCreateWithoutProductsInput>
  }

  export type ProductUpsertWithoutModifierGroupsInput = {
    update: XOR<ProductUpdateWithoutModifierGroupsInput, ProductUncheckedUpdateWithoutModifierGroupsInput>
    create: XOR<ProductCreateWithoutModifierGroupsInput, ProductUncheckedCreateWithoutModifierGroupsInput>
    where?: ProductWhereInput
  }

  export type ProductUpdateToOneWithWhereWithoutModifierGroupsInput = {
    where?: ProductWhereInput
    data: XOR<ProductUpdateWithoutModifierGroupsInput, ProductUncheckedUpdateWithoutModifierGroupsInput>
  }

  export type ProductUpdateWithoutModifierGroupsInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    prepTimeMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: CategoryUpdateOneRequiredWithoutProductsNestedInput
  }

  export type ProductUncheckedUpdateWithoutModifierGroupsInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    categoryId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    prepTimeMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ModifierGroupUpsertWithoutProductsInput = {
    update: XOR<ModifierGroupUpdateWithoutProductsInput, ModifierGroupUncheckedUpdateWithoutProductsInput>
    create: XOR<ModifierGroupCreateWithoutProductsInput, ModifierGroupUncheckedCreateWithoutProductsInput>
    where?: ModifierGroupWhereInput
  }

  export type ModifierGroupUpdateToOneWithWhereWithoutProductsInput = {
    where?: ModifierGroupWhereInput
    data: XOR<ModifierGroupUpdateWithoutProductsInput, ModifierGroupUncheckedUpdateWithoutProductsInput>
  }

  export type ModifierGroupUpdateWithoutProductsInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    minSelections?: IntFieldUpdateOperationsInput | number
    maxSelections?: IntFieldUpdateOperationsInput | number
    isRequired?: BoolFieldUpdateOperationsInput | boolean
    options?: ModifierOptionUpdateManyWithoutGroupNestedInput
  }

  export type ModifierGroupUncheckedUpdateWithoutProductsInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    minSelections?: IntFieldUpdateOperationsInput | number
    maxSelections?: IntFieldUpdateOperationsInput | number
    isRequired?: BoolFieldUpdateOperationsInput | boolean
    options?: ModifierOptionUncheckedUpdateManyWithoutGroupNestedInput
  }

  export type ProductCreateManyCategoryInput = {
    id?: string
    tenantId: string
    name: string
    description?: string | null
    price: Decimal | DecimalJsLike | number | string
    imageUrl?: string | null
    isAvailable?: boolean
    sortOrder?: number
    prepTimeMinutes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProductUpdateWithoutCategoryInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    prepTimeMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    modifierGroups?: ProductModifierGroupUpdateManyWithoutProductNestedInput
  }

  export type ProductUncheckedUpdateWithoutCategoryInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    prepTimeMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    modifierGroups?: ProductModifierGroupUncheckedUpdateManyWithoutProductNestedInput
  }

  export type ProductUncheckedUpdateManyWithoutCategoryInput = {
    id?: StringFieldUpdateOperationsInput | string
    tenantId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    imageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    prepTimeMinutes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductModifierGroupCreateManyProductInput = {
    groupId: string
  }

  export type ProductModifierGroupUpdateWithoutProductInput = {
    group?: ModifierGroupUpdateOneRequiredWithoutProductsNestedInput
  }

  export type ProductModifierGroupUncheckedUpdateWithoutProductInput = {
    groupId?: StringFieldUpdateOperationsInput | string
  }

  export type ProductModifierGroupUncheckedUpdateManyWithoutProductInput = {
    groupId?: StringFieldUpdateOperationsInput | string
  }

  export type ModifierOptionCreateManyGroupInput = {
    id?: string
    name: string
    priceDelta?: Decimal | DecimalJsLike | number | string
    isDefault?: boolean
  }

  export type ProductModifierGroupCreateManyGroupInput = {
    productId: string
  }

  export type ModifierOptionUpdateWithoutGroupInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    priceDelta?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isDefault?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ModifierOptionUncheckedUpdateWithoutGroupInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    priceDelta?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isDefault?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ModifierOptionUncheckedUpdateManyWithoutGroupInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    priceDelta?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isDefault?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ProductModifierGroupUpdateWithoutGroupInput = {
    product?: ProductUpdateOneRequiredWithoutModifierGroupsNestedInput
  }

  export type ProductModifierGroupUncheckedUpdateWithoutGroupInput = {
    productId?: StringFieldUpdateOperationsInput | string
  }

  export type ProductModifierGroupUncheckedUpdateManyWithoutGroupInput = {
    productId?: StringFieldUpdateOperationsInput | string
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use CategoryCountOutputTypeDefaultArgs instead
     */
    export type CategoryCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = CategoryCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ProductCountOutputTypeDefaultArgs instead
     */
    export type ProductCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ProductCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ModifierGroupCountOutputTypeDefaultArgs instead
     */
    export type ModifierGroupCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ModifierGroupCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use CategoryDefaultArgs instead
     */
    export type CategoryArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = CategoryDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ProductDefaultArgs instead
     */
    export type ProductArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ProductDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ModifierGroupDefaultArgs instead
     */
    export type ModifierGroupArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ModifierGroupDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ModifierOptionDefaultArgs instead
     */
    export type ModifierOptionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ModifierOptionDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ProductModifierGroupDefaultArgs instead
     */
    export type ProductModifierGroupArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ProductModifierGroupDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}