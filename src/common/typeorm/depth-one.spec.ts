import { depthOne } from './depth-one.js';

describe('depthOne', () => {
  it('loads to-one relations only, with eager loading off', () => {
    const repository = {
      metadata: {
        relations: [
          { propertyName: 'role', isManyToOne: true },
          { propertyName: 'profile', isOneToOne: true },
          { propertyName: 'permissions', isManyToMany: true },
          { propertyName: 'stockLevels', isOneToMany: true },
        ],
      },
    };
    expect(depthOne(repository as any)).toEqual({
      relations: { role: true, profile: true },
      loadEagerRelations: false,
    });
  });
});
