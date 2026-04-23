// Entity representing a Pokemon
import { Entity, PrimaryColumn, Column, ManyToMany, JoinTable, OneToMany, Relation } from 'typeorm';
import { Type } from './type.entity';
import { Appearance } from './appearance.entity';

@Entity('pokemons')
export class Pokemon {
  @PrimaryColumn()
  id: number;

  @Column()
  name: string;

  @ManyToMany(() => Type, (type) => type.pokemons, { cascade: true })
  @JoinTable({
    name: 'pokemon_types',
    joinColumn: { name: 'pokemon_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'type_id', referencedColumnName: 'id' },
  })
  types: Relation<Type[]>;

  @OneToMany(() => Appearance, (appearance) => appearance.pokemon)
  appearances: Relation<Appearance[]>;
}
