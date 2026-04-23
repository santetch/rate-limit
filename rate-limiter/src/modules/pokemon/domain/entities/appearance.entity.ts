import { Entity, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Relation } from 'typeorm';
import { Pokemon } from './pokemon.entity';

@Entity('appearances')
export class Appearance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => Pokemon, (pokemon) => pokemon.appearances, { cascade: true })
  @JoinColumn({ name: 'pokemon_id' })
  pokemon: Relation<Pokemon>;
}
