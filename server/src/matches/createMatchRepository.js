import { InMemoryMatchRepository } from './InMemoryMatchRepository.js';
import { MysqlMatchRepository } from './MysqlMatchRepository.js';

export function createMatchRepository(databasePool) {
  return databasePool
    ? new MysqlMatchRepository({ pool: databasePool })
    : new InMemoryMatchRepository();
}
