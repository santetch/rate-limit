import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, Relation } from 'typeorm';
import { Pokemon } from './pokemon.entity';

@Entity('types')
export class Type {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @ManyToMany(() => Pokemon, (pokemon) => pokemon.types)
  pokemons: Relation<Pokemon[]>;
}
