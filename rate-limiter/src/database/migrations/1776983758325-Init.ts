import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1776983758325 implements MigrationInterface {
    name = 'Init1776983758325'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, CONSTRAINT "UQ_fa170fda66d232af69b7f880c9e" UNIQUE ("name"), CONSTRAINT "PK_33b81de5358589c738907c3559b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "appearances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "pokemon_id" integer, CONSTRAINT "PK_0ad92ffd5fb6882e4f27f729c63" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "pokemons" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_a3172290413af616d9cfa1fdc9a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "pokemon_types" ("pokemon_id" integer NOT NULL, "type_id" uuid NOT NULL, CONSTRAINT "PK_8483942fa9aa8551a4f09308242" PRIMARY KEY ("pokemon_id", "type_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d159dc1249158366905f58b8a6" ON "pokemon_types" ("pokemon_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_38c11b73183551cb8a8b9f522c" ON "pokemon_types" ("type_id") `);
        await queryRunner.query(`ALTER TABLE "appearances" ADD CONSTRAINT "FK_f94045f03e1c53b764931d56ae0" FOREIGN KEY ("pokemon_id") REFERENCES "pokemons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pokemon_types" ADD CONSTRAINT "FK_d159dc1249158366905f58b8a6d" FOREIGN KEY ("pokemon_id") REFERENCES "pokemons"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "pokemon_types" ADD CONSTRAINT "FK_38c11b73183551cb8a8b9f522c0" FOREIGN KEY ("type_id") REFERENCES "types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pokemon_types" DROP CONSTRAINT "FK_38c11b73183551cb8a8b9f522c0"`);
        await queryRunner.query(`ALTER TABLE "pokemon_types" DROP CONSTRAINT "FK_d159dc1249158366905f58b8a6d"`);
        await queryRunner.query(`ALTER TABLE "appearances" DROP CONSTRAINT "FK_f94045f03e1c53b764931d56ae0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_38c11b73183551cb8a8b9f522c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d159dc1249158366905f58b8a6"`);
        await queryRunner.query(`DROP TABLE "pokemon_types"`);
        await queryRunner.query(`DROP TABLE "pokemons"`);
        await queryRunner.query(`DROP TABLE "appearances"`);
        await queryRunner.query(`DROP TABLE "types"`);
    }

}
