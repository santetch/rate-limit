import { DataSource, DataSourceOptions } from 'typeorm';
import { Pokemon } from '../modules/pokemon/domain/entities/pokemon.entity';
import { Type } from '../modules/pokemon/domain/entities/type.entity';
import { Appearance } from '../modules/pokemon/domain/entities/appearance.entity';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT as string, 10) || 5432,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'pokemon',
  entities: [Pokemon, Type, Appearance],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false, // We'll use migrations
};

export const dataSource = new DataSource(dataSourceOptions);
