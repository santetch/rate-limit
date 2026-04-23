import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IPokemonRepository, Pokemon } from '../domain/pokemon.interface';
import { Pokemon as PokemonEntity } from '../domain/entities/pokemon.entity';
import { Type as TypeEntity } from '../domain/entities/type.entity';
import { Appearance as AppearanceEntity } from '../domain/entities/appearance.entity';

@Injectable()
export class TypeormPokemonRepository implements IPokemonRepository {
  constructor(
    @InjectRepository(PokemonEntity)
    private readonly pokemonRepository: Repository<PokemonEntity>,
    @InjectRepository(TypeEntity)
    private readonly typeRepository: Repository<TypeEntity>,
    @InjectRepository(AppearanceEntity)
    private readonly appearanceRepository: Repository<AppearanceEntity>,
  ) {}

  async saveAppearance(pokemon: Pokemon): Promise<void> {
    const types = await Promise.all(
      pokemon.types.map(async (typeName) => {
        let type = await this.typeRepository.findOne({ where: { name: typeName } });
        if (!type) {
          type = this.typeRepository.create({ name: typeName });
          await this.typeRepository.save(type);
        }
        return type;
      }),
    );

    let pokemonEntity = await this.pokemonRepository.findOne({ where: { id: pokemon.id } });
    if (!pokemonEntity) {
      pokemonEntity = this.pokemonRepository.create({
        id: pokemon.id,
        name: pokemon.name,
        types: types,
      });
      await this.pokemonRepository.save(pokemonEntity);
    } else {
      pokemonEntity.types = types;
      await this.pokemonRepository.save(pokemonEntity);
    }

    const appearance = this.appearanceRepository.create({
      pokemon: pokemonEntity,
    });
    await this.appearanceRepository.save(appearance);
  }

  async getRanking(): Promise<{ name: string; appearances: number }[]> {
    const ranking = await this.appearanceRepository
      .createQueryBuilder('appearance')
      .leftJoinAndSelect('appearance.pokemon', 'pokemon')
      .select('pokemon.name', 'name')
      .addSelect('COUNT(appearance.id)', 'appearances')
      .groupBy('pokemon.id')
      .orderBy('appearances', 'DESC')
      .getRawMany();

    return ranking.map((r) => ({
      name: r.name,
      appearances: Number(r.appearances),
    }));
  }
}
