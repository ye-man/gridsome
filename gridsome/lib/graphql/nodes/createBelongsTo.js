const { PER_PAGE, SORT_ORDER } = require('../../utils/constants')
const createFieldDefinitions = require('../createFieldDefinitions')

const {
  createPagedNodeEdges,
  createBelongsToKey,
  createSortOptions
} = require('./utils')

const {
  createFilterTypes,
  createFilterQuery
} = require('../createFilterTypes')

module.exports = function createBelongsTo ({
  schemaComposer,
  typeNames,
  typeName
}) {
  const belongsToUnionType = schemaComposer.createUnionTC({
    interfaces: ['Node'],
    name: `${typeName}BelongsToUnion`,
    types: typeNames
  })

  const belongsToEdgeType = schemaComposer.createObjectTC({
    name: `${typeName}BelongsToEdge`,
    fields: {
      node: belongsToUnionType,
      next: belongsToUnionType,
      previous: belongsToUnionType
    }
  })

  const belongsToType = schemaComposer.createObjectTC({
    name: `${typeName}BelongsTo`,
    fields: {
      totalCount: 'Int!',
      pageInfo: 'PageInfo!',
      edges: [belongsToEdgeType]
    }
  })

  const typeNameEnum = schemaComposer.createEnumTC({
    name: `${typeName}BelongsToTypeNameEnum`,
    values: typeNames.reduce((acc, value) => (acc[value] = { value } && acc), {})
  })

  const belongsToArgs = {
    sortBy: { type: 'String', defaultValue: 'date' },
    order: { type: 'SortOrder', defaultValue: SORT_ORDER },
    perPage: { type: 'Int', description: `Defaults to ${PER_PAGE} when page is provided.` },
    skip: { type: 'Int', defaultValue: 0 },
    limit: { type: 'Int' },
    page: { type: 'Int' },
    sort: '[SortArgument!]'
  }

  const filterPrefix = `${typeName}BelongsToFilter`
  const nodeFields = createFieldDefinitions([{ id: '', path: '' }])
  const filterArgs = createFilterTypes(schemaComposer, nodeFields, filterPrefix)

  belongsToArgs.filter = {
    description: `Filter for ${typeName} nodes.`,
    type: schemaComposer.createInputTC({
      name: `${typeName}BelongsToFilters`,
      fields: {
        ...filterArgs,
        typeName: {
          type: schemaComposer.createInputTC({
            name: `${filterPrefix}TypeName`,
            description: 'Filter nodes by typeName.',
            fields: {
              regex: 'String',
              eq: typeNameEnum,
              ne: typeNameEnum,
              in: [typeNameEnum],
              nin: [typeNameEnum]
            }
          })
        }
      }
    })
  }

  const filterFields = belongsToArgs.filter.type.getType().getFields()

  return {
    type: () => belongsToType,
    args: belongsToArgs,
    resolve (node, { filter, ...args }, { store }) {
      const key = createBelongsToKey(node)
      const sort = createSortOptions(args)
      const query = { [key]: { $eq: true }}

      if (filter) {
        Object.assign(query, createFilterQuery(filter, filterFields))
      }

      const chain = store.chainIndex(query)

      return createPagedNodeEdges(chain, args, sort)
    }
  }
}
